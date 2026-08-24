import { PrismaClient } from '@prisma/client'

// Pre-hashed passwords (bcrypt, 10 rounds) for demo accounts
const ADMIN_HASH = '$2a$10$srvVAtyA8dgT0fhyJSVhIOfS8qsZFmA4wM3V0mn8Qdd3VKjIhIlU2'
const TEACHER_HASH = '$2a$10$NThh3He.v3e.l5dF5MJqNuXwPGJW3F4JHCm Tinymock' // placeholder; will replace below
const STUDENT_HASH = '$2a$10$NThh3He.v3e.l5dF5MJqNuXwPGJW3F4JHCm Tinymock'
const PARENT_HASH = '$2a$10$NThh3He.v3e.l5dF5MJqNuXwPGJW3F4JHCm Tinymock'

export default async function seed(prisma: PrismaClient) {
  // --- Academic Year ---
  const ay = await prisma.academicYear.create({
    data: { name: '2025/2026', startDate: new Date('2025-08-19'), endDate: new Date('2026-05-30'), isCurrent: true },
  })

  // --- Terms ---
  await prisma.term.createMany({
    data: [
      { name: 'T1', academicYearId: ay.id, startDate: new Date('2025-08-19'), endDate: new Date('2025-12-20'), isCurrent: false },
      { name: 'T2', academicYearId: ay.id, startDate: new Date('2025-12-21'), endDate: new Date('2026-04-30'), isCurrent: true },
      { name: 'T3', academicYearId: ay.id, startDate: new Date('2026-05-01'), endDate: new Date('2026-07-31'), isCurrent: false },
    ],
    skipDuplicates: true,
  })

  // --- Subjects ---
  const subjCodes = ['MATH', 'ENG', 'PHY', 'CHEM', 'BIO', 'HIST', 'GEO', 'CS', 'ART', 'PE']
  const subjNames: Record<string, string> = {
    MATH: 'Mathematics', ENG: 'English', PHY: 'Physics', CHEM: 'Chemistry',
    BIO: 'Biology', HIST: 'History', GEO: 'Geography', CS: 'Computer Science',
    ART: 'Art', PE: 'Physical Education',
  }
  const subjData = subjCodes.map(code => ({ code, name: subjNames[code] }))
  await prisma.subject.createMany({ data: subjData, skipDuplicates: true })

  // --- Classes ---
  const grades = [9, 9, 10, 10, 11, 12]
  const letters = ['A', 'B', 'A', 'B', 'A', 'A']
  const classData = grades.map((g, i) => ({
    name: `Grade ${g}${letters[i]}`, gradeLevel: g, academicYearId: ay.id,
  }))
  await prisma.class.createMany({ data: classData, skipDuplicates: true })

  // --- Users (with hashed passwords) ---
  const adminPassHash = ADMIN_HASH
  const teacherPassHash = TEACHER_HASH
  const studentPassHash = STUDENT_HASH
  const parentPassHash = PARENT_HASH

  const userData = [
    { email: 'admin@schoolhub.edu', passwordHash: adminPassHash, name: 'School Administrator', role: 'ADMIN' },
    { email: 'teacher1@schoolhub.edu', passwordHash: teacherPassHash, name: 'Sarah Whitfield', role: 'TEACHER' },
    { email: 'student1@schoolhub.edu', passwordHash: studentPassHash, name: 'Student1', role: 'STUDENT' },
    { email: 'student2@schoolhub.edu', passwordHash: studentPassHash, name: 'Student2', role: 'STUDENT' },
    { email: 'student3@schoolhub.edu', passwordHash: studentPassHash, name: 'Student3', role: 'STUDENT' },
    { email: 'student4@schoolhub.edu', passwordHash: studentPassHash, name: 'Student4', role: 'STUDENT' },
    { email: 'parent1@schoolhub.edu', passwordHash: parentPassHash, name: 'Parent1', role: 'PARENT' },
    { email: 'parent2@schoolhub.edu', passwordHash: parentPassHash, name: 'Parent2', role: 'PARENT' },
  ]
  await prisma.user.createMany({ data: userData, skipDuplicates: true })

  // --- Retrieve created records ---
  const allUsers = await prisma.user.findMany()
  const admin = allUsers.find(u => u.email === 'admin@schoolhub.edu')
  const teachers = allUsers.filter(u => u.role === 'TEACHER')
  const students2 = allUsers.filter(u => u.role === 'STUDENT')
  const parents2 = allUsers.filter(u => u.role === 'PARENT')

  // --- Student profiles + admission numbers ---
  const admissionNums = ['SH-2025-001', 'SH-2025-002', 'SH-2025-003', 'SH-2025-004']
  const studentPromises = students2.map((u, i) =>
    prisma.student.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, admissionNumber: admissionNums[i], dateOfBirth: new Date('2008-01-01'), gender: i % 2 === 0 ? 'Male' : 'Female', address: `123 Student St, City${i + 1}`, phone: `(555) 010${i + 1}` },
    })
  )
  await Promise.all(studentPromises)

  // --- Parent-Student links ---
  await prisma.parentStudentLink.createMany({
    data: parents2.flatMap((p, pi) =>
      students2.slice(pi * 2, pi * 2 + 2).map(s => ({ parentId: p.id, studentId: s.id, relationship: 'Parent' }))
    ).filter(Boolean),
    skipDuplicates: true,
  })

  // --- Enrollments ---
  const allClasses = await prisma.class.findMany()
  const enrollPromises = students2.slice(0, 8).map((s, i) =>
    prisma.enrollment.upsert({
      where: { studentId_academicYearId: { studentId: s.id, academicYearId: ay.id } },
      update: {},
      create: { studentId: s.id, classId: allClasses[i % allClasses].id, academicYearId: ay.id, enrolledAt: new Date() },
    })
  )
  await Promise.all(enrollPromises)

  // --- ClassSubject (teacher per class+subject) ---
  const allSubjects = await prisma.subject.findMany()
  const classSubjectData = allClasses.flatMap(c =>
    allSubjects.map(s => ({
      classId: c.id, subjectId: s.id,
      teacherId: teachers[(c.gradeLevel % teachers.length) || 1].id,
    }))
  )
  await prisma.classSubject.createMany({ data: classSubjectData, skipDuplicates: true })

  // --- Timetable entries ---
  const periods = ['08:00-08:55', '09:00-09:55', '10:00-10:55', '11:15-12:10', '12:15-13:10', '13:45-14:40', '14:45-15:40']
  const days = [1, 2, 3, 4, 5]
  const timetable: any[] = []
  let ei = 0
  for (const c of allClasses) {
    for (const s of allSubjects) {
      const teacher = teachers[(c.gradeLevel % teachers.length) || 1]
      for (const day of days) {
        const p = periods[ei % periods.length]; ei += 1
        const room = `Rm ${String.fromCharCode(65 + ei % 8)}0${String.floor(ei / 8) + 101}`
        timetable.push({ classId: c.id, subjectId: s.id, teacherId: teacher.id, dayOfWeek: day, startTime: p.split('-')[0], endTime: p.split('-')[1], room })
      }
    }
  }
  await prisma.timetableEntry.createMany({ data: timetable, skipDuplicates: true })

  // --- Attendance (20 school days from term start) ---
  const base = new Date('2025-08-19')
  const att: any[] = []
  const stdCount = students2.length
  for (let s = 0; s < stdCount; s++) {
    const enroll = await prisma.enrollment.findFirst({ where: { studentId: students2[s].id } })
    if (!enroll) continue
    for (let d = 0; d < 20; d++) {
      const day = new Date(base)
      day.setDate(base.getDate() + d)
      const dow = day.getDay()
      if (dow === 0 || dow === 6) continue
      const statuses = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'EXCUSED', 'ABSENT', 'ABSENT', 'ABSENT', 'ABSENT', 'ABSENT']
      att.push({ studentId: students2[s].id, classId: enroll.classId, date: new Date(day.setHours(8, 0, 0, 0)), status: statuses[d] })
    }
  }
  await prisma.attendance.createMany({ data: att, skipDuplicates: true })

  // --- Assignments (2 per class-subject) ---
  const assign: any[] = []
  let ai = 0
  for (const c of allClasses) {
    for (const s of allSubjects) {
      for (let a = 0; a < 2; a++) {
        const dueDate = new Date('2025-11-01')
        dueDate.setDate(dueDate.getDate() + (a === 0 ? -30 : 30))
        assign.push({ title: `Assignment ${String.fromCharCode(65 + ai)} - ${s.name}`, description: `Complete the task on ${s.name}`, classId: c.id, subjectId: s.id, dueDate: new Date(dueDate.setHours(23, 59, 59, 0)), maxScore: 100, createdById: admin!.id })
        ai += 1
      }
    }
  }
  await prisma.assignment.createMany({ data: assign, skipDuplicates: true })

  // --- Assignment submissions ---
  const subs: any[] = []
  let si = 0
  const aLimited = await prisma.assignment.findMany({ take: 6 })
  for (const a of aLimited) {
    for (let sub = 0; sub < 3; sub++) {
      const stud = await prisma.student.findFirst({ take: 1 })
      if (!stud) continue
      const submittedAt = new Date(a.dueDate)
      submittedAt.setDate(submittedAt.getDate() + (sub === 1 ? -5 : 5))
      const status = submittedAt > a.dueDate ? 'LATE' : 'SUBMITTED'
      subs.push({ assignmentId: a.id, studentId: stud.id, content: `Sample work for ${a.title}`, submittedAt: new Date(submittedAt.setHours(10, 0, 0, 0)), status, score: sub < 2 ? null : 85 + sub * 5, feedback: sub < 2 ? null : 'Good effort.' })
      si += 1
    }
  }
  await prisma.assignmentSubmission.createMany({ data: subs, skipDuplicates: true })

  // --- Assessments (Quiz + Test per class-subject) ---
  const assess: any[] = []
  let ai2 = 0
  for (const c of allClasses) {
    for (const s of allSubjects) {
      assess.push({ title: `Quiz 1 - ${s.name}`, type: 'QUIZ', classId: c.id, subjectId: s.id, maxScore: 20, weight: 0.1, date: new Date('2025-10-15'), createdById: admin!.id })
      assess.push({ title: `Midterm Test - ${s.name}`, type: 'TEST', classId: c.id, subjectId: s.id, maxScore: 50, weight: 0.2, date: new Date('2025-11-20'), createdById: admin!.id })
      ai2 += 1
    }
  }
  await prisma.assessment.createMany({ data: assess, skipDuplicates: true })

  // --- Grades ---
  const gradesData: any[] = []
  let gi = 0
  const a2 = await prisma.assessment.findMany({ take: 6 })
  for (const a of a2) {
    const enrolls = await prisma.enrollment.findMany({ where: { classId: a.classId } })
    for (const e of enrolls) {
      const score = 65 + (gi % 30)
      gi += 1
      gradesData.push({ assessmentId: a.id, studentId: e.studentId, score, maxScore: a.maxScore, feedback: score > 80 ? 'Excellent work!' : null })
    }
  }
  await prisma.grade.createMany({ data: gradesData, skipDuplicates: true })

  // --- Notifications ---
  const notif: any[] = []
  const nLimit = Math.min(2, students2.length)
  for (let i = 0; i < nLimit; i++) {
    const s = students2[i]
    notif.push({ userId: s.id, type: 'NEW_ASSIGNMENT', title: 'New assignment posted', body: 'A new mathematics assignment has been due soon.', linkUrl: '/assignments' })
    notif.push({ userId: s.id, type: 'GRADE_POSTED', title: 'Grade posted', body: 'Your recent quiz score has been published.', linkUrl: '/grades' })
  }
  await prisma.notification.createMany({ data: notif, skipDuplicates: true })

  // --- Conversations + messages ---
  const t = teachers[0]
  const p = parents2[0]
  const existingConv = await prisma.conversation.findFirst({
    where: { participants: { every: { userId: { in: [t.id, p.id] } } } },
  })
  let convId = existingConv?.id
  if (!convId) {
    const newConv = await prisma.conversation.create({
      data: { participants: { create: [{ userId: t.id }, { userId: p.id }] } },
    })
    convId = newConv.id
  }
  await prisma.message.createMany({
    data: [
      { conversationId: convId!, senderId: t.id, body: 'Hello, how is your child progressing?' },
      { conversationId: convId!, senderId: p.id, body: "He's doing well, thank you!" },
    ],
    skipDuplicates: true,
  })

  const s2 = students2[1]
  const t2 = teachers[1]
  const existingConv2 = await prisma.conversation.findFirst({
    where: { participants: { every: { userId: { in: [t2.id, s2.id] } } } },
  })
  let convId2 = existingConv2?.id
  if (!convId2) {
    const newConv2 = await prisma.conversation.create({
      data: { participants: { create: [{ userId: t2.id }, { userId: s2.id }] } },
    })
    convId2 = newConv2.id
  }
  await prisma.message.createMany({
    data: [
      { conversationId: convId2!, senderId: s2.id, body: 'Can I get extra help after class?' },
      { conversationId: convId2!, senderId: t2.id, body: 'Of course! Come by during office hours.' },
    ],
    skipDuplicates: true,
  })

  console.log('Seed completed successfully')
}