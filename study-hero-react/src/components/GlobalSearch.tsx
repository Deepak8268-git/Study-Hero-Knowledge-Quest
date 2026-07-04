import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, getAuthRole, getAuthToken } from '../services/api';

interface SearchItem {
  id: string;
  type: 'course' | 'quiz' | 'assignment' | 'announcement';
  title: string;
  subtitle?: string;
  href: string;
  date?: string;
}

const typeLabels: Record<SearchItem['type'], string> = {
  course: 'Course',
  quiz: 'Quiz',
  assignment: 'Assignment',
  announcement: 'Announcement'
};

const GlobalSearch: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchItem['type'] | 'all'>('all');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const authenticated = !!getAuthToken();

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open || !authenticated) return;

    const loadSearchData = async () => {
      try {
        setLoading(true);
        const role = getAuthRole();
        const results: SearchItem[] = [];
        const courses = await apiRequest<any[]>('/api/courses');
        courses.forEach((course) => {
          results.push({ id: `course-${course.id}`, type: 'course', title: course.title, subtitle: course.teacher_name, href: `/course/${course.id}`, date: course.updated_at || course.created_at });
        });

        if (role === 'teacher') {
          const dashboard = await apiRequest<any>('/api/dashboard/teacher');
          (dashboard.quizzes || []).forEach((quiz: any) => results.push({ id: `quiz-${quiz.id}`, type: 'quiz', title: quiz.title, subtitle: quiz.courseName, href: `/quiz/${quiz.id}`, date: quiz.createdAt }));
          (dashboard.assignments || []).forEach((assignment: any) => results.push({ id: `assignment-${assignment.id}`, type: 'assignment', title: assignment.title, subtitle: assignment.course, href: `/assignment/${assignment.id}/review`, date: assignment.due_date }));
        } else {
          const dashboard = await apiRequest<any>('/api/dashboard/student');
          (dashboard.scheduledQuizzes || []).forEach((quiz: any) => results.push({ id: `quiz-${quiz.id}`, type: 'quiz', title: quiz.title, subtitle: quiz.courseName, href: `/quiz/${quiz.id}`, date: quiz.scheduledDate }));
          (dashboard.assignments || []).forEach((assignment: any) => results.push({ id: `assignment-${assignment.id}`, type: 'assignment', title: assignment.title, subtitle: assignment.course, href: `/assignment/${assignment.id}`, date: assignment.dueDate }));
        }

        const announcementResults = await Promise.allSettled(
          courses.slice(0, 10).map((course) => apiRequest<any[]>(`/api/announcements/course/${course.id}`))
        );
        announcementResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            result.value.forEach((announcement: any) => results.push({
              id: `announcement-${announcement.id}`,
              type: 'announcement',
              title: announcement.title,
              subtitle: announcement.teacher_name,
              href: `/course/${announcement.course_id}`,
              date: announcement.created_at
            }));
          }
        });

        setItems(results);
      } catch (error) {
        console.error('Global search load failed:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSearchData();
  }, [open, authenticated]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items
      .filter((item) => filter === 'all' || item.type === filter)
      .filter((item) => !normalized || `${item.title} ${item.subtitle || ''}`.toLowerCase().includes(normalized))
      .slice(0, 20);
  }, [filter, items, query]);

  if (!authenticated) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden lg:inline-flex items-center gap-2 px-3 py-2 border border-white/30 rounded-md text-sm hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="Open global search"
      >
        <i className="ri-search-line"></i>
        Search
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-start justify-center px-4 pt-24" role="dialog" aria-modal="true" aria-label="Global search">
          <div className="bg-white text-gray-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              <i className="ri-search-line text-xl text-primary"></i>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search courses, quizzes, assignments, announcements"
                className="flex-1 outline-none text-sm"
                aria-label="Search query"
              />
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700" aria-label="Close search">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2">
              {(['all', 'course', 'quiz', 'assignment', 'announcement'] as const).map((item) => (
                <button key={item} type="button" onClick={() => setFilter(item)} className={`px-3 py-1 rounded-full text-xs ${filter === item ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {item === 'all' ? 'All' : typeLabels[item]}
                </button>
              ))}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-sm text-gray-500">Loading searchable data...</div>
              ) : filteredItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">No matching records found.</div>
              ) : filteredItems.map((item) => (
                <Link key={item.id} to={item.href} onClick={() => setOpen(false)} className="block px-4 py-3 border-b border-gray-100 hover:bg-primary/5 focus:bg-primary/5 focus:outline-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-800">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{typeLabels[item.type]}{item.subtitle ? ` · ${item.subtitle}` : ''}</p>
                    </div>
                    {item.date && <span className="text-[11px] text-gray-400 whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;