package com.lifetrack.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetrack.domain.model.AttendanceStatus
import com.lifetrack.domain.model.Subject
import com.lifetrack.domain.model.VtuGrade
import com.lifetrack.domain.model.VtuGradingSystem
import com.lifetrack.domain.model.VtuSubject
import com.lifetrack.domain.usecase.VtuCalculatorUseCase
import com.lifetrack.ui.theme.LifeTrackEmeraldPrimary

@Composable
fun VtuAcademicsView(
    modifier: Modifier = Modifier
) {
    val calculator = remember { VtuCalculatorUseCase() }

    // Sample VTU subjects for 5th Sem CSE (2022 Scheme)
    val subjects = remember {
        mutableStateListOf(
            Subject("s1", "BCS501", "Software Engineering & Project Management", credits = 3, semester = 5, attendedClasses = 32, totalClasses = 36),
            Subject("s2", "BCS502", "Computer Networks", credits = 4, semester = 5, attendedClasses = 38, totalClasses = 48),
            Subject("s3", "BCS503", "Theory of Computation", credits = 4, semester = 5, attendedClasses = 42, totalClasses = 46),
            Subject("s4", "BCSL504", "Computer Networks Laboratory", credits = 1, semester = 5, attendedClasses = 14, totalClasses = 15),
            Subject("s5", "BCS515A", "Cloud Computing Elective", credits = 3, semester = 5, attendedClasses = 24, totalClasses = 35)
        )
    }

    var selectedTab by remember { mutableStateOf("Attendance") } // "Attendance" or "SGPA"

    Column(modifier = modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp)) {
        // Tab switcher
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0xFFE2E8F0))
                .padding(4.dp)
        ) {
            val tabs = listOf("Attendance", "SGPA Calculator")
            tabs.forEach { tab ->
                val isSelected = tab == selectedTab
                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp)),
                    color = if (isSelected) Color.White else Color.Transparent,
                    onClick = { selectedTab = tab }
                ) {
                    Box(
                        modifier = Modifier.padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = tab,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) LifeTrackEmeraldPrimary else Color(0xFF64748B),
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        if (selectedTab == "Attendance") {
            // Overall attendance summary
            val totalAttended = subjects.sumOf { it.attendedClasses }
            val totalConducted = subjects.sumOf { it.totalClasses }
            val overallPercent = if (totalConducted > 0) (totalAttended.toDouble() / totalConducted) * 100.0 else 100.0

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("VTU 85% Attendance Compliance", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text("Minimum 75% with medical condonation", fontSize = 12.sp, color = Color.Gray)
                        }
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = when {
                                overallPercent >= 85.0 -> Color(0xFFD1FAE5)
                                overallPercent >= 75.0 -> Color(0xFFFEF3C7)
                                else -> Color(0xFFFEE2E2)
                            }
                        ) {
                            Text(
                                text = "${overallPercent.toInt()}% Overall",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = when {
                                    overallPercent >= 85.0 -> Color(0xFF065F46)
                                    overallPercent >= 75.0 -> Color(0xFF92400E)
                                    else -> Color(0xFF991B1B)
                                }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    LinearProgressIndicator(
                        progress = { (overallPercent / 100.0).toFloat().coerceIn(0f, 1f) },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(CircleShape),
                        color = if (overallPercent >= 85.0) LifeTrackEmeraldPrimary else Color(0xFFE11D48),
                        trackColor = Color(0xFFE2E8F0)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(subjects, key = { it.id }) { subject ->
                    val report = calculator.analyzeAttendance(subject, 85.0)
                    AttendanceSubjectCard(
                        subject = subject,
                        report = report,
                        onIncrementAttended = {
                            val idx = subjects.indexOfFirst { it.id == subject.id }
                            if (idx != -1) {
                                subjects[idx] = subject.copy(
                                    attendedClasses = subject.attendedClasses + 1,
                                    totalClasses = subject.totalClasses + 1
                                )
                            }
                        },
                        onIncrementMissed = {
                            val idx = subjects.indexOfFirst { it.id == subject.id }
                            if (idx != -1) {
                                subjects[idx] = subject.copy(
                                    totalClasses = subject.totalClasses + 1
                                )
                            }
                        }
                    )
                }
            }
        } else {
            // SGPA / CGPA Calculator Tab
            VtuSgpaCalculatorView()
        }
    }
}

@Composable
fun AttendanceSubjectCard(
    subject: Subject,
    report: com.lifetrack.domain.model.AttendanceReport,
    onIncrementAttended: () -> Unit,
    onIncrementMissed: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(1.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(subject.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text("${subject.code} • ${subject.credits} Credits", fontSize = 11.sp, color = Color.Gray)
                }
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = when (report.status) {
                        AttendanceStatus.SAFE -> Color(0xFFD1FAE5)
                        AttendanceStatus.WARNING -> Color(0xFFFEF3C7)
                        AttendanceStatus.CRITICAL -> Color(0xFFFEE2E2)
                    }
                ) {
                    Text(
                        text = "${subject.attendancePercentage.toInt()}%",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = when (report.status) {
                            AttendanceStatus.SAFE -> Color(0xFF065F46)
                            AttendanceStatus.WARNING -> Color(0xFF92400E)
                            AttendanceStatus.CRITICAL -> Color(0xFF991B1B)
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "${subject.attendedClasses}/${subject.totalClasses} classes attended",
                fontSize = 12.sp,
                color = Color(0xFF475569)
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Guidance text
            Text(
                text = when {
                    report.status == AttendanceStatus.SAFE -> "✓ Can safely miss ${report.classesCanBunk} more classes"
                    report.classesNeededForTarget > 0 -> "⚠ Must attend next ${report.classesNeededForTarget} classes to restore 85%"
                    else -> "Warning: Below 85% requirement"
                },
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = if (report.status == AttendanceStatus.SAFE) Color(0xFF0F766E) else Color(0xFFBE123C)
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onIncrementAttended,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F766E)),
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier.weight(1f).height(34.dp)
                ) {
                    Text("+ Attended", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }

                Button(
                    onClick = onIncrementMissed,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1F5F9)),
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier.weight(1f).height(34.dp)
                ) {
                    Text("+ Missed", fontSize = 11.sp, color = Color(0xFF475569), fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
fun VtuSgpaCalculatorView() {
    val sampleSubjects = remember {
        mutableStateListOf(
            VtuSubject("BCS501", "Software Eng", 3, VtuGrade.A_PLUS),
            VtuSubject("BCS502", "Computer Networks", 4, VtuGrade.A),
            VtuSubject("BCS503", "Theory of Computation", 4, VtuGrade.B_PLUS),
            VtuSubject("BCSL504", "CN Lab", 1, VtuGrade.O),
            VtuSubject("BCS515A", "Cloud Computing", 3, VtuGrade.A)
        )
    }

    val sgpa = VtuGradingSystem.calculateSgpa(sampleSubjects)
    val percentage = VtuCalculatorUseCase().calculatePercentage(sgpa)

    Column(modifier = Modifier.fillMaxSize()) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
        ) {
            Column(modifier = Modifier.padding(18.dp)) {
                Text("VTU CBCS SGPA (2022 Scheme)", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = String.format("%.2f", sgpa),
                            color = Color(0xFF2DD4BF),
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text("Semester SGPA", color = Color(0xFF94A3B8), fontSize = 11.sp)
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = String.format("%.1f%%", percentage),
                            color = Color.White,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text("(SGPA - 0.75) × 10", color = Color(0xFF94A3B8), fontSize = 11.sp)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Text("Registered Subjects & Grade Points", fontWeight = FontWeight.Bold, fontSize = 14.sp)
        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(sampleSubjects) { sub ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(sub.name, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text("${sub.code} • ${sub.credits} credits", fontSize = 11.sp, color = Color.Gray)
                        }
                        Surface(
                            color = Color(0xFFF1F5F9),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = "Grade ${sub.grade?.name ?: "P"} (${sub.grade?.gradePoints ?: 0} pts)",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = Color(0xFF0F766E)
                            )
                        }
                    }
                }
            }
        }
    }
}
