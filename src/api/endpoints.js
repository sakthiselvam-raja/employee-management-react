import { api } from './client';

const data = (p) => p.then((r) => r.data);

/* ---------- auth ---------- */
export const authApi = {
  me: () => data(api.get('/auth/me')).then((d) => d.user),
  adminLogin: (body) => data(api.post('/auth/admin/login', body)).then((d) => d.user),
  userLogin: (body) => data(api.post('/auth/user/login', body)).then((d) => d.user),
  logout: () => data(api.post('/auth/logout')),
  changePassword: (body) => data(api.post('/auth/change-password', body)),
};

/* ---------- admin ---------- */
export const adminApi = {
  dashboard: (date, params) => data(api.get('/admin/dashboard', { params: { date, ...params } })),
  dashboardSubmissions: (params) => data(api.get('/admin/dashboard/submissions', { params })),
  dashboardStorage: () => data(api.get('/admin/dashboard/storage')),

  users: (params) => data(api.get('/admin/users', { params })).then((d) => d.users),
  /** paginated: { users, total, page, limit, pages } — pass page + limit */
  usersPage: (params) => data(api.get('/admin/users', { params })),
  createUser: (body) => data(api.post('/admin/users', body)),
  bulkCreateUsers: (file, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    return data(api.post('/admin/users/bulk', form, {
      onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
      timeout: 0,
    }));
  },
  updateUser: (id, body) => data(api.put(`/admin/users/${id}`, body)),
  setUserStatus: (id, isActive) => data(api.patch(`/admin/users/${id}/status`, { isActive })),
  resetPassword: (id) => data(api.post(`/admin/users/${id}/reset-password`)),
  deleteUser: (id) => data(api.delete(`/admin/users/${id}`)),

  uploads: () => data(api.get('/admin/uploads')).then((d) => d.uploads),
  upload: (id) => data(api.get(`/admin/uploads/${id}`)).then((d) => d.upload),
  uploadLimits: () => data(api.get('/admin/uploads/limits')),
  uploadZip: (file, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    return data(api.post('/admin/uploads', form, {
      onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
      timeout: 0,
    }));
  },
  deleteUpload: (id, force = false) => data(api.delete(`/admin/uploads/${id}`, { params: { force } })),
  folderImages: (folderId, from, to, page, pageSize, q) => data(api.get(`/admin/files/folders/${folderId}/images`, { params: { from, to, page, pageSize, q } })),
  excelPreview: (id) => data(api.get(`/admin/files/excel/${id}/preview`)),
  submissionPreview: (id) => data(api.get(`/admin/files/submissions/${id}/preview`)),

  assignments: (params) => data(api.get('/admin/assignments', { params })).then((d) => d.assignments),
  /** paginated: pass page + pageSize -> { assignments, total, page, pageSize, pages, counts } */
  assignmentsPage: (params) => data(api.get('/admin/assignments', { params })),
  assignment: (id, subPage, subPageSize) => data(api.get(`/admin/assignments/${id}`, { params: { subPage, subPageSize } })),
  createAssignment: (body) => data(api.post('/admin/assignments', body)),
  updateAssignment: (id, body) => data(api.put(`/admin/assignments/${id}`, body)),
  setAssignmentStatus: (id, status) => data(api.patch(`/admin/assignments/${id}/status`, { status })),
  bulkStatus: (ids, status) => data(api.post('/admin/assignments/bulk-status', { ids, status })),
  deleteAssignment: (id) => data(api.delete(`/admin/assignments/${id}`)),

  historyFiles: (params) => data(api.get('/admin/history/files', { params })),
  historyActivity: (params) => data(api.get('/admin/history/activity', { params })),
};

/* ---------- user ---------- */
export const userApi = {
  assignments: (params) => data(api.get('/user/assignments', { params })).then((d) => d.assignments),
  assignment: (id) => data(api.get(`/user/assignments/${id}`)),
  setStatus: (id, status) => data(api.patch(`/user/assignments/${id}/status`, { status })),
  rangeImages: (id, rangeId, page, pageSize) => data(api.get(`/user/assignments/${id}/ranges/${rangeId}/images`, { params: { page, pageSize } })),
  excelPreview: (id, excelId) => data(api.get(`/user/assignments/${id}/excel/${excelId}/preview`)),
  submissionPreview: (id) => data(api.get(`/user/submissions/${id}/preview`)),
  deleteSubmission: (id) => data(api.delete(`/user/submissions/${id}`)),
  /** preview of a file the user just picked (nothing is saved) */
  previewFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return data(api.post('/user/preview-file', form));
  },
  submit: (id, { file, notes, markCompleted }, onProgress) => {
    const form = new FormData();
    if (file) form.append('file', file);
    form.append('notes', notes || '');
    form.append('markCompleted', markCompleted ? 'true' : 'false');
    return data(api.post(`/user/assignments/${id}/submissions`, form, {
      onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    }));
  },
};

/* ---------- download / image URLs (used in <a href> and <img src>) ---------- */
export const urls = {
  admin: {
    uploadZip: (id) => `/admin/uploads/${id}/download`,
    uploadOriginalZip: (id) => `/admin/uploads/${id}/original-download`,
    uploadSubmissionsZip: (id) => `/admin/uploads/${id}/submissions-download`,
    assignmentsExport: (params) => `/admin/assignments/export?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))}`,
    image: (id) => `/admin/files/images/${id}`,
    imageDownload: (id) => `/admin/files/images/${id}?download=1`,
    excel: (id) => `/admin/files/excel/${id}/download`,
    submission: (id) => `/admin/files/submissions/${id}/download`,
    assignmentZip: (id) => `/admin/assignments/${id}/download`,
  },
  user: {
    image: (aid, imgId) => `/user/assignments/${aid}/images/${imgId}`,
    imageDownload: (aid, imgId) => `/user/assignments/${aid}/images/${imgId}?download=1`,
    excel: (aid, excelId) => `/user/assignments/${aid}/excel/${excelId}/download`,
    rangeZip: (aid, rangeId) => `/user/assignments/${aid}/ranges/${rangeId}/download`,
    assignmentZip: (aid) => `/user/assignments/${aid}/download`,
    submission: (id) => `/user/submissions/${id}/download`,
  },
};