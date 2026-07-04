import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import EmptyState from '../components/EmptyState';
import SkeletonBlock from '../components/LoadingStates';
import { apiRequest, getAuthRole, getAuthToken } from '../services/api';

interface Course {
  id: number;
  title: string;
  name?: string;
}

interface AttendanceSession {
  id: number;
  title: string;
  course_title?: string;
  session_date: string;
  status: string;
}

interface AttendanceSummary {
  percentage: number;
  records: Array<{ id: number; status: string; title: string; session_date: string; course_title?: string }>;
}

interface TimetableEntry {
  id: number;
  subject: string;
  course_title?: string;
  classroom?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface CalendarEvent {
  id: number;
  type: string;
  title: string;
  start_at: string;
  end_at?: string;
}

interface GradebookEntry {
  id: number;
  title: string;
  course_title?: string;
  score: number;
  max_score: number;
  graded_at: string;
}

interface ForumPost {
  id: number;
  title: string;
  content: string;
  type: string;
  author_name?: string;
  created_at: string;
}

interface Note {
  id: number;
  title: string;
  content: string;
  category?: string;
  updated_at: string;
}

interface Bookmark {
  id: number;
  target_type: string;
  target_id: string;
  title?: string;
  created_at: string;
}

interface Certificate {
  id: number;
  certificate_uid: string;
  title: string;
  type: string;
  issued_at: string;
}

interface LeaderboardEntry {
  user_id: number;
  username: string;
  xp: number;
  level: number;
  streak_days: number;
}

type Tab = 'overview' | 'attendance' | 'timetable' | 'calendar' | 'gradebook' | 'forum' | 'resources';

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
  { id: 'attendance', label: 'Attendance', icon: 'ri-user-check-line' },
  { id: 'timetable', label: 'Timetable', icon: 'ri-calendar-schedule-line' },
  { id: 'calendar', label: 'Calendar', icon: 'ri-calendar-event-line' },
  { id: 'gradebook', label: 'Gradebook', icon: 'ri-graduation-cap-line' },
  { id: 'forum', label: 'Forum', icon: 'ri-discuss-line' },
  { id: 'resources', label: 'Resources', icon: 'ri-folder-line' }
];

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDate = (value?: string) => {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleString();
};

const getCourseTitle = (course: Course) => course.title || course.name || `Course ${course.id}`;

const LmsPage: React.FC = () => {
  const role = getAuthRole();
  const isTeacher = role === 'teacher';
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [gradebook, setGradebook] = useState<GradebookEntry[]>([]);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [attendanceTitle, setAttendanceTitle] = useState('');
  const [attendanceDate, setAttendanceDate] = useState('');
  const [timetableSubject, setTimetableSubject] = useState('');
  const [calendarTitle, setCalendarTitle] = useState('');
  const [forumTitle, setForumTitle] = useState('');
  const [forumContent, setForumContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [bookmarkTitle, setBookmarkTitle] = useState('');

  const courseQuery = selectedCourseId ? `?courseId=${selectedCourseId}` : '';

  const loadLmsData = async () => {
    if (!getAuthToken()) return;
    setLoading(true);
    setError('');
    try {
      const [courseData, sessionsData, timetableData, calendarData, gradebookData, notesData, bookmarkData, certificateData, leaderboardData] = await Promise.all([
        apiRequest<Course[]>('/api/courses'),
        apiRequest<AttendanceSession[]>(`/api/lms/attendance/sessions${courseQuery}`),
        apiRequest<TimetableEntry[]>(`/api/lms/timetable${courseQuery}`),
        apiRequest<CalendarEvent[]>('/api/lms/calendar/events'),
        apiRequest<GradebookEntry[]>(`/api/lms/gradebook${courseQuery}`),
        apiRequest<Note[]>('/api/lms/notes'),
        apiRequest<Bookmark[]>('/api/lms/bookmarks'),
        apiRequest<Certificate[]>('/api/lms/certificates'),
        apiRequest<LeaderboardEntry[]>('/api/lms/gamification/leaderboard')
      ]);
      setCourses(courseData);
      setAttendanceSessions(sessionsData);
      setTimetable(timetableData);
      setCalendarEvents(calendarData);
      setGradebook(gradebookData);
      setNotes(notesData);
      setBookmarks(bookmarkData);
      setCertificates(certificateData);
      setLeaderboard(leaderboardData);
      if (!isTeacher) {
        const summary = await apiRequest<AttendanceSummary>('/api/lms/attendance/student');
        setAttendanceSummary(summary);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load LMS workspace.');
    } finally {
      setLoading(false);
    }
  };

  const loadForum = async () => {
    if (!selectedCourseId) {
      setForumPosts([]);
      return;
    }
    try {
      const posts = await apiRequest<ForumPost[]>(`/api/lms/forum/course/${selectedCourseId}`);
      setForumPosts(posts);
    } catch (err: any) {
      setError(err.message || 'Unable to load forum posts.');
    }
  };

  useEffect(() => {
    loadLmsData();
  }, [selectedCourseId]);

  useEffect(() => {
    loadForum();
  }, [selectedCourseId]);

  const selectedCourse = useMemo(() => courses.find((course) => course.id === selectedCourseId), [courses, selectedCourseId]);

  const runMutation = async (action: () => Promise<any>, success: string) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await loadLmsData();
      await loadForum();
    } catch (err: any) {
      setError(err.message || 'Request failed.');
    } finally {
      setSaving(false);
    }
  };

  const createAttendanceSession = () => {
    if (!selectedCourseId || !attendanceTitle.trim() || !attendanceDate) return;
    runMutation(() => apiRequest('/api/lms/attendance/sessions', {
      method: 'POST',
      body: JSON.stringify({ courseId: selectedCourseId, title: attendanceTitle, sessionDate: attendanceDate })
    }), 'Attendance session created.');
    setAttendanceTitle('');
    setAttendanceDate('');
  };

  const createTimetableEntry = () => {
    if (!selectedCourseId || !timetableSubject.trim()) return;
    runMutation(() => apiRequest('/api/lms/timetable', {
      method: 'POST',
      body: JSON.stringify({ courseId: selectedCourseId, subject: timetableSubject, dayOfWeek: new Date().getDay(), startTime: '09:00', endTime: '10:00' })
    }), 'Timetable entry created.');
    setTimetableSubject('');
  };

  const createCalendarEvent = () => {
    if (!calendarTitle.trim()) return;
    runMutation(() => apiRequest('/api/lms/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ courseId: selectedCourseId || null, type: 'academic', title: calendarTitle, startAt: new Date().toISOString(), visibility: selectedCourseId ? 'course' : 'private' })
    }), 'Calendar event created.');
    setCalendarTitle('');
  };

  const createForumPost = () => {
    if (!selectedCourseId || !forumTitle.trim() || !forumContent.trim()) return;
    runMutation(() => apiRequest('/api/lms/forum/posts', {
      method: 'POST',
      body: JSON.stringify({ courseId: selectedCourseId, title: forumTitle, content: forumContent })
    }), 'Forum post created.');
    setForumTitle('');
    setForumContent('');
  };

  const createNote = () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;
    runMutation(() => apiRequest('/api/lms/notes', {
      method: 'POST',
      body: JSON.stringify({ courseId: selectedCourseId || null, title: noteTitle, content: noteContent })
    }), 'Note saved.');
    setNoteTitle('');
    setNoteContent('');
  };

  const createBookmark = () => {
    if (!bookmarkTitle.trim()) return;
    runMutation(() => apiRequest('/api/lms/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ targetType: selectedCourseId ? 'course' : 'workspace', targetId: String(selectedCourseId || 'lms'), title: bookmarkTitle })
    }), 'Bookmark saved.');
    setBookmarkTitle('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 enterprise-page">
      <Header />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Enterprise LMS</h1>
              <p className="text-gray-600 mt-2">Attendance, scheduling, progress, grades, discussions, resources, and certificates from live Study Hero data.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value ? Number(event.target.value) : '')} className="border border-gray-300 rounded-md px-3 py-2 bg-white min-w-64" aria-label="Filter LMS workspace by course">
                <option value="">All accessible courses</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{getCourseTitle(course)}</option>)}
              </select>
              <button onClick={loadLmsData} disabled={loading} className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">Refresh</button>
            </div>
          </div>

          {error && <div className="mb-4 bg-red-50 border-l-4 border-danger text-danger p-3 rounded text-sm">{error}</div>}
          {notice && <div className="mb-4 bg-green-50 border-l-4 border-green-500 text-green-700 p-3 rounded text-sm">{notice}</div>}

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="border-b border-gray-100 flex flex-wrap">
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 text-sm font-medium flex items-center gap-2 ${activeTab === tab.id ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`} aria-pressed={activeTab === tab.id}>
                  <i className={tab.icon}></i>{tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {loading ? <SkeletonBlock rows={8} /> : (
                <>
                  {activeTab === 'overview' && (
                    <section className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <MetricCard label="Attendance sessions" value={attendanceSessions.length} icon="ri-user-check-line" />
                        <MetricCard label="Calendar events" value={calendarEvents.length} icon="ri-calendar-event-line" />
                        <MetricCard label="Grade entries" value={gradebook.length} icon="ri-graduation-cap-line" />
                        <MetricCard label="Certificates" value={certificates.length} icon="ri-award-line" />
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ListPanel title="Upcoming Calendar" emptyTitle="No calendar events" items={calendarEvents.slice(0, 5).map((event) => ({ id: event.id, title: event.title, meta: `${event.type} - ${formatDate(event.start_at)}` }))} />
                        <ListPanel title="Leaderboard" emptyTitle="No gamification records" items={leaderboard.slice(0, 5).map((entry) => ({ id: entry.user_id, title: entry.username, meta: `${entry.xp} XP - Level ${entry.level}` }))} />
                      </div>
                    </section>
                  )}

                  {activeTab === 'attendance' && (
                    <section className="space-y-6">
                      {isTeacher && <ActionRow disabled={!selectedCourseId || saving} placeholder="Session title" value={attendanceTitle} onChange={setAttendanceTitle} secondaryValue={attendanceDate} onSecondaryChange={setAttendanceDate} secondaryType="date" buttonLabel="Create session" onSubmit={createAttendanceSession} />}
                      {!isTeacher && attendanceSummary && <MetricCard label="Attendance percentage" value={`${attendanceSummary.percentage}%`} icon="ri-pie-chart-line" />}
                      <ListPanel title="Attendance Sessions" emptyTitle="No attendance sessions" items={attendanceSessions.map((session) => ({ id: session.id, title: session.title, meta: `${session.course_title || selectedCourse?.title || 'Course'} - ${session.session_date} - ${session.status}` }))} />
                    </section>
                  )}

                  {activeTab === 'timetable' && (
                    <section className="space-y-6">
                      {isTeacher && <ActionRow disabled={!selectedCourseId || saving} placeholder="Subject" value={timetableSubject} onChange={setTimetableSubject} buttonLabel="Add timetable entry" onSubmit={createTimetableEntry} />}
                      <ListPanel title="Timetable" emptyTitle="No timetable entries" items={timetable.map((entry) => ({ id: entry.id, title: entry.subject, meta: `${dayNames[entry.day_of_week] || 'Day'} - ${entry.start_time} to ${entry.end_time} - ${entry.classroom || entry.course_title || 'Course'}` }))} />
                    </section>
                  )}

                  {activeTab === 'calendar' && (
                    <section className="space-y-6">
                      <ActionRow disabled={saving} placeholder="Calendar event title" value={calendarTitle} onChange={setCalendarTitle} buttonLabel="Add event" onSubmit={createCalendarEvent} />
                      <ListPanel title="Calendar Events" emptyTitle="No calendar events" items={calendarEvents.map((event) => ({ id: event.id, title: event.title, meta: `${event.type} - ${formatDate(event.start_at)}` }))} />
                    </section>
                  )}

                  {activeTab === 'gradebook' && (
                    <section className="space-y-6">
                      <ListPanel title="Gradebook" emptyTitle="No gradebook entries" items={gradebook.map((entry) => ({ id: entry.id, title: entry.title, meta: `${entry.course_title || 'Course'} - ${entry.score}/${entry.max_score} - ${formatDate(entry.graded_at)}` }))} />
                    </section>
                  )}

                  {activeTab === 'forum' && (
                    <section className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <input value={forumTitle} onChange={(event) => setForumTitle(event.target.value)} className="border border-gray-300 rounded-md px-3 py-2" placeholder="Discussion title" />
                        <input value={forumContent} onChange={(event) => setForumContent(event.target.value)} className="border border-gray-300 rounded-md px-3 py-2" placeholder="Message" />
                        <button onClick={createForumPost} disabled={!selectedCourseId || saving} className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">Post discussion</button>
                      </div>
                      <ListPanel title="Course Forum" emptyTitle={selectedCourseId ? 'No discussion posts' : 'Select a course to view forum posts'} items={forumPosts.map((post) => ({ id: post.id, title: post.title, meta: `${post.author_name || 'Member'} - ${post.type} - ${formatDate(post.created_at)}`, body: post.content }))} />
                    </section>
                  )}

                  {activeTab === 'resources' && (
                    <section className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Note title" />
                          <textarea value={noteContent} onChange={(event) => setNoteContent(event.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" rows={4} placeholder="Personal note" />
                          <button onClick={createNote} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">Save note</button>
                        </div>
                        <div className="space-y-3">
                          <input value={bookmarkTitle} onChange={(event) => setBookmarkTitle(event.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Bookmark title" />
                          <button onClick={createBookmark} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">Save bookmark</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <ListPanel title="Notes" emptyTitle="No personal notes" items={notes.map((note) => ({ id: note.id, title: note.title, meta: note.category || formatDate(note.updated_at), body: note.content }))} />
                        <ListPanel title="Bookmarks" emptyTitle="No bookmarks" items={bookmarks.map((bookmark) => ({ id: bookmark.id, title: bookmark.title || bookmark.target_type, meta: `${bookmark.target_type} #${bookmark.target_id}` }))} />
                        <ListPanel title="Certificates" emptyTitle="No certificates" items={certificates.map((certificate) => ({ id: certificate.id, title: certificate.title, meta: `${certificate.type} - ${certificate.certificate_uid}` }))} />
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string | number; icon: string }> = ({ label, value, icon }) => (
  <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      </div>
      <i className={`${icon} text-3xl text-primary`}></i>
    </div>
  </div>
);

const ActionRow: React.FC<{
  disabled?: boolean;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  secondaryValue?: string;
  onSecondaryChange?: (value: string) => void;
  secondaryType?: string;
  buttonLabel: string;
  onSubmit: () => void;
}> = ({ disabled, placeholder, value, onChange, secondaryValue, onSecondaryChange, secondaryType = 'text', buttonLabel, onSubmit }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    <input value={value} onChange={(event) => onChange(event.target.value)} className="border border-gray-300 rounded-md px-3 py-2" placeholder={placeholder} />
    {onSecondaryChange ? <input type={secondaryType} value={secondaryValue || ''} onChange={(event) => onSecondaryChange(event.target.value)} className="border border-gray-300 rounded-md px-3 py-2" /> : <div className="hidden md:block"></div>}
    <button onClick={onSubmit} disabled={disabled} className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">{buttonLabel}</button>
  </div>
);

const ListPanel: React.FC<{ title: string; emptyTitle: string; items: Array<{ id: number | string; title: string; meta?: string; body?: string }> }> = ({ title, emptyTitle, items }) => (
  <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
    <h2 className="font-semibold text-gray-800 mb-4">{title}</h2>
    {items.length === 0 ? <EmptyState title={emptyTitle} /> : (
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="border border-gray-100 rounded-md p-3">
            <h3 className="font-medium text-gray-800">{item.title}</h3>
            {item.meta && <p className="text-xs text-gray-500 mt-1">{item.meta}</p>}
            {item.body && <p className="text-sm text-gray-600 mt-2 line-clamp-3">{item.body}</p>}
          </article>
        ))}
      </div>
    )}
  </div>
);

export default LmsPage;
