// Every page, loaded on demand. App.jsx uses these for lazy(), and this file can also
// download a page EARLY (before the user clicks), so it opens instantly.
export const pageLoaders = {
  dashboard: () => import('./pages/admin/Dashboard'),
  users: () => import('./pages/admin/Users'),
  uploads: () => import('./pages/admin/Uploads'),
  uploadDetail: () => import('./pages/admin/UploadDetail'),
  assignments: () => import('./pages/admin/Assignments'),
  history: () => import('./pages/admin/History'),
  myTasks: () => import('./pages/user/MyTasks'),
  taskDetail: () => import('./pages/user/TaskDetail'),
};

// Menu link -> pages that link opens
const linkPages = {
  '/admin': ['dashboard'],
  '/admin/users': ['users'],
  '/admin/uploads': ['uploads', 'uploadDetail'],
  '/admin/assignments': ['assignments'],
  '/admin/history': ['history'],
  '/emp-portal/tasks': ['myTasks', 'taskDetail'],
};

// Pages each role uses
const rolePages = {
  ADMIN: ['dashboard', 'users', 'uploads', 'uploadDetail', 'assignments', 'history'],
  USER: ['myTasks', 'taskDetail'],
};

// Downloading a page twice is harmless: the browser keeps the first copy.
const download = (names) => names.forEach((name) => pageLoaders[name]().catch(() => {}));

/** Mouse over / focus on a menu link: download that page now. */
export const prefetchRoute = (path) => download(linkPages[path] || []);

/** After login: quietly download all pages of this role. */
export const prefetchPortal = (role) => setTimeout(() => download(rolePages[role] || []), 1500);