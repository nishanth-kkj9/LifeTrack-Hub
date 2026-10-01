package com.lifetrack.core.json

/**
 * Lightweight, robust, pure Kotlin Multiplatform JSON parser and serializer.
 * Conforms to RFC 8259:
 * - Full string escape handling (\", \\, \/, \b, \f, \n, \r, \t, \uXXXX)
 * - Objects, Arrays, Strings, Numbers, Booleans, Null
 * - Used for Firestore REST payload and delta encoding without regex hazards.
 */
sealed class JsonElement {
    abstract fun toJsonString(): String

    open fun asObject(): JsonObject = this as JsonObject
    open fun asArray(): JsonArray = this as JsonArray
    open fun asPrimitive(): JsonPrimitive = this as JsonPrimitive

    open val stringOrNull: String?
        get() = (this as? JsonPrimitive)?.stringValue

    open val longOrNull: Long?
        get() = (this as? JsonPrimitive)?.stringValue?.toLongOrNull()

    open val intOrNull: Int?
        get() = (this as? JsonPrimitive)?.stringValue?.toIntOrNull()

    open val booleanOrNull: Boolean?
        get() = (this as? JsonPrimitive)?.stringValue?.toBooleanStrictOrNull()
}

class JsonObject(val fields: Map<String, JsonElement>) : JsonElement() {
    constructor(vararg pairs: Pair<String, JsonElement>) : this(pairs.toMap())

    fun get(key: String): JsonElement? = fields[key]
    fun getString(key: String): String? = fields[key]?.stringOrNull
    fun getLong(key: String): Long? = fields[key]?.longOrNull
    fun getInt(key: String): Int? = fields[key]?.intOrNull
    fun getBoolean(key: String): Boolean? = fields[key]?.booleanOrNull
    fun getObject(key: String): JsonObject? = fields[key] as? JsonObject
    fun getArray(key: String): JsonArray? = fields[key] as? JsonArray

    override fun toJsonString(): String {
        return fields.entries.joinToString(
            separator = ",",
            prefix = "{",
            postfix = "}"
        ) { (key, value) ->
            "\"${JsonEscaper.escape(key)}\":${value.toJsonString()}"
        }
    }

    override fun toString(): String = toJsonString()
}

class JsonArray(val elements: List<JsonElement>) : JsonElement() {
    constructor(vararg items: JsonElement) : this(items.toList())

    fun get(index: Int): JsonElement = elements[index]
    val size: Int get() = elements.size

    override fun toJsonString(): String {
        return elements.joinToString(
            separator = ",",
            prefix = "[",
            postfix = "]"
        ) { it.toJsonString() }
    }

    override fun toString(): String = toJsonString()
}

class JsonPrimitive(val rawValue: Any?) : JsonElement() {
    val isString: Boolean get() = rawValue is String
    val isNumber: Boolean get() = rawValue is Number
    val isBoolean: Boolean get() = rawValue is Boolean
    val isNull: Boolean get() = rawValue == null

    val stringValue: String?
        get() = rawValue?.toString()

    override fun toJsonString(): String {
        return when (rawValue) {
            null -> "null"
            is String -> "\"${JsonEscaper.escape(rawValue)}\""
            is Number, is Boolean -> rawValue.toString()
            else -> "\"${JsonEscaper.escape(rawValue.toString())}\""
        }
    }

    override fun toString(): String = toJsonString()
}

object JsonEscaper {
    fun escape(string: String): String {
        val sb = StringBuilder(string.length + 16)
        for (char in string) {
            when (char) {
                '\"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\b' -> sb.append("\\b")
                '\u000c' -> sb.append("\\f")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                else -> {
                    if (char.code in 0..0x1F) {
                        val hex = char.code.toString(16).padStart(4, '0')
                        sb.append("\\u").append(hex)
                    } else {
                        sb.append(char)
                    }
                }
            }
        }
        return sb.toString()
    }

    fun unescape(string: String): String {
        val sb = StringBuilder(string.length)
        var i = 0
        while (i < string.length) {
            val c = string[i]
            if (c == '\\' && i + 1 < string.length) {
                val next = string[i + 1]
                when (next) {
                    '\"' -> { sb.append('\"'); i += 2 }
                    '\\' -> { sb.append('\\'); i += 2 }
                    '/' -> { sb.append('/'); i += 2 }
                    'b' -> { sb.append('\b'); i += 2 }
                    'f' -> { sb.append('\u000c'); i += 2 }
                    'n' -> { sb.append('\n'); i += 2 }
                    'r' -> { sb.append('\r'); i += 2 }
                    't' -> { sb.append('\t'); i += 2 }
                    'u' -> {
                        if (i + 5 < string.length) {
                            val hex = string.substring(i + 2, i + 6)
                            val code = hex.toIntOrNull(16)
                            if (code != null) {
                                sb.append(code.toChar())
                                i += 6
                            } else {
                                sb.append(c)
                                i++
                            }
                        } else {
                            sb.append(c)
                            i++
                        }
                    }
                    else -> {
                        sb.append(next)
                        i += 2
                    }
                }
            } else {
                sb.append(c)
                i++
            }
        }
        return sb.toString()
    }
}

class JsonParser(private val src: String) {
    private var pos = 0

    fun parse(): JsonElement {
        skipWhitespace()
        val result = parseValue()
        skipWhitespace()
        return result
    }

    private fun parseValue(): JsonElement {
        skipWhitespace()
        if (pos >= src.length) return JsonPrimitive(null)
        return when (val ch = src[pos]) {
            '{' -> parseObject()
            '[' -> parseArray()
            '\"' -> parseString()
            't', 'f' -> parseBoolean()
            'n' -> parseNull()
            else -> {
                if (ch == '-' || ch.isDigit()) {
                    parseNumber()
                } else {
                    throw IllegalArgumentException("Unexpected character '$ch' at position $pos in JSON")
                }
            }
        }
    }

    private fun parseObject(): JsonObject {
        expect('{')
        val map = mutableMapOf<String, JsonElement>()
        skipWhitespace()
        if (peek() == '}') {
            pos++
            return JsonObject(map)
        }
        while (pos < src.length) {
            skipWhitespace()
            val keyElement = parseString()
            val key = keyElement.stringValue ?: ""
            skipWhitespace()
            expect(':')
            val value = parseValue()
            map[key] = value
            skipWhitespace()
            val next = peek()
            if (next == ',') {
                pos++
            } else if (next == '}') {
                pos++
                break
            } else {
                throw IllegalArgumentException("Expected ',' or '}' at position $pos")
            }
        }
        return JsonObject(map)
    }

    private fun parseArray(): JsonArray {
        expect('[')
        val list = mutableListOf<JsonElement>()
        skipWhitespace()
        if (peek() == ']') {
            pos++
            return JsonArray(list)
        }
        while (pos < src.length) {
            val value = parseValue()
            list.add(value)
            skipWhitespace()
            val next = peek()
            if (next == ',') {
                pos++
            } else if (next == ']') {
                pos++
                break
            } else {
                throw IllegalArgumentException("Expected ',' or ']' at position $pos")
            }
        }
        return JsonArray(list)
    }

    private fun parseString(): JsonPrimitive {
        expect('\"')
        val start = pos
        var escaped = false
        while (pos < src.length) {
            val c = src[pos]
            if (c == '\\') {
                escaped = true
                pos += 2
                continue
            }
            if (c == '\"') {
                val raw = src.substring(start, pos)
                pos++
                val unescaped = if (escaped) JsonEscaper.unescape(raw) else raw
                return JsonPrimitive(unescaped)
            }
            pos++
        }
        throw IllegalArgumentException("Unterminated string starting at $start")
    }

    private fun parseNumber(): JsonPrimitive {
        val start = pos
        if (src[pos] == '-') pos++
        while (pos < src.length && (src[pos].isDigit() || src[pos] == '.' || src[pos] == 'e' || src[pos] == 'E' || src[pos] == '+' || src[pos] == '-')) {
            pos++
        }
        val numStr = src.substring(start, pos)
        val num: Any = numStr.toLongOrNull() ?: numStr.toDoubleOrNull() ?: numStr
        return JsonPrimitive(num)
    }

    private fun parseBoolean(): JsonPrimitive {
        return if (src.startsWith("true", pos)) {
            pos += 4
            JsonPrimitive(true)
        } else if (src.startsWith("false", pos)) {
            pos += 5
            JsonPrimitive(false)
        } else {
            throw IllegalArgumentException("Invalid boolean literal at $pos")
        }
    }

    private fun parseNull(): JsonPrimitive {
        return if (src.startsWith("null", pos)) {
            pos += 4
            JsonPrimitive(null)
        } else {
            throw IllegalArgumentException("Invalid null literal at $pos")
        }
    }

    private fun skipWhitespace() {
        while (pos < src.length && src[pos].isWhitespace()) {
            pos++
        }
    }

    private fun peek(): Char = if (pos < src.length) src[pos] else '\u0000'

    private fun expect(ch: Char) {
        if (pos >= src.length || src[pos] != ch) {
            throw IllegalArgumentException("Expected '$ch' at position $pos but found '${peek()}'")
        }
        pos++
    }

    companion object {
        fun parse(jsonString: String): JsonElement {
            return JsonParser(jsonString.trim()).parse()
        }

        fun parseObject(jsonString: String): JsonObject {
            val elem = parse(jsonString)
            return elem as? JsonObject ?: throw IllegalArgumentException("Expected JSON object but got $elem")
        }
    }
}
