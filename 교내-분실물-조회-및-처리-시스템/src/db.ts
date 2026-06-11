import { Post, Comment, User, Report } from './types';

// Storage key to cache the currently logged-in user session in the client browser
const SESSION_STORAGE_KEY = 'school_lost_found_logged_in_user';

/**
 * Generic API request helper to enforce DRY principles, eliminate duplicate code, 
 * and handle server communication errors gracefully.
 * 
 * @param path REST API subpath (e.g. '/api/posts')
 * @param method HTTP Method string (GET, POST, PUT, DELETE)
 * @param body Optional JSON body object
 * @param headers Optional custom header key/value map
 * @returns Parsed JSON response from server
 */
async function requestApi<T>(
  path: string, 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', 
  body?: any, 
  headers: Record<string, string> = {}
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(path, options);
    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { message: errorText };
      }
      throw new Error(errorJson.message || `API Error: ${response.status} ${response.statusText}`);
    }
    return await response.json() as T;
  } catch (error) {
    console.error(`Fetch API Error [${method} ${path}]:`, error);
    throw error;
  }
}

/**
 * Safe client-side no-op to satisfy components that still call initializeDB on mount,
 * as database initialization is now securely run on the server's backend.
 */
export const initializeDB = () => {
  // Safe mock since the database boots server-side on port 3000 automatically
};

// --- USER RECRUITMENT & SESSION CONTROLLER ---

/**
 * Retrieves list of all registered member accounts from server database.
 * This is restricted to system administrators.
 * 
 * @param adminId Login ID of currently active system administrator
 * @returns Array of safe User records (without passwords)
 */
export const getUsers = async (adminId?: string): Promise<User[] | any> => {
  if (!adminId) {
    const cached = getCurrentUser();
    adminId = cached?.id;
  }
  
  try {
    const res = await requestApi<{ success: boolean; users: User[] }>('/api/users', 'GET', null, {
      'x-admin-id': adminId || ''
    });
    return res.users || [];
  } catch {
    return [];
  }
};

/**
 * Submits a new student user registration query to the persistent server database.
 * Checks for duplication in ID, Student ID, and Email.
 * 
 * @param user Full User object containing login credentials
 * @returns Object indicating operation success/failure with detail message
 */
export const registerUser = async (user: User): Promise<{ success: boolean; message: string }> => {
  try {
    return await requestApi<{ success: boolean; message: string }>('/api/users/register', 'POST', user);
  } catch (error: any) {
    return { success: false, message: error.message || '회원가입 요청 중 실패가 발생했습니다.' };
  }
};

/**
 * Authenticates login credentials against server database, 
 * cache details inside browser session localStorage for instant retrieval on page refreshes.
 * 
 * @param id Entered User-selected login ID
 * @param password Entered Password string
 * @returns Object indication of login outcomes alongside the authenticated User model
 */
export const loginUser = async (
  id: string, 
  password: string
): Promise<{ success: boolean; user?: User; message: string }> => {
  try {
    const response = await requestApi<{ success: boolean; user: User; message: string }>('/api/users/login', 'POST', {
      id,
      password
    });
    
    if (response.success && response.user) {
      // Store current authenticated user trace in browser local storage
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(response.user));
    }
    return response;
  } catch (error: any) {
    return { success: false, message: error.message || '로그인 중 통신 실패가 발생했습니다.' };
  }
};

/**
 * Irreversibly purges active student user trace from browser caching to end session.
 */
export const logoutUser = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

/**
 * Instantly parses and delivers currently logged-in user profile from local cache metadata.
 * 
 * @returns User object or null if guest student
 */
export const getCurrentUser = (): User | null => {
  try {
    const data = localStorage.getItem(SESSION_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/**
 * Admin action to permanently delete an student account.
 * Drops associated posts and comments cascadingly.
 * 
 * @param userId Student ID to remove
 * @param adminId Submitting admin's ID for authentication check
 * @returns Success status and feedback message
 */
export const deleteUser = async (
  userId: string, 
  adminId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    return await requestApi<{ success: boolean; message: string }>(`/api/users/${userId}`, 'DELETE', null, {
      'x-admin-id': adminId
    });
  } catch (error: any) {
    return { success: false, message: error.message || '사용자 삭제 처리가 실패했습니다.' };
  }
};


// --- POSTING REPORT INTERACTORS ---

/**
 * Queries entire lost & found posts collection from persistent server-side database.
 * 
 * @returns Array of posts
 */
export const getPosts = async (): Promise<Post[]> => {
  try {
    const res = await requestApi<{ success: boolean; posts: Post[] }>('/api/posts', 'GET');
    return res.posts || [];
  } catch {
    return [];
  }
};

/**
 * Safe client placeholder to maintain backward compatibility.
 * Back-end server now manages posts updates internally.
 */
export const setPosts = (posts: Post[]) => {
  // Securely operated by backend to block direct client overrides
};

/**
 * Inserts a brand new lost/found report directly to server backend.
 * 
 * @param post Omit fields that are automatically handled on server creation
 * @returns Fully generated Post item
 */
export const addPost = async (
  post: Omit<Post, 'id' | 'createdAt' | 'views' | 'resolved'>
): Promise<Post> => {
  const res = await requestApi<{ success: boolean; post: Post }>('/api/posts', 'POST', post);
  return res.post;
};

/**
 * Updates an existing post report contents or resolved attributes in server database.
 * Supports authors or system administrators.
 * 
 * @param postId ID of the target report
 * @param updatedFields Fields subset to change
 * @returns Updated Post instance or null if post not found
 */
export const updatePost = async (
  postId: string, 
  updatedFields: Partial<Post>
): Promise<Post | null> => {
  const user = getCurrentUser();
  const body = {
    ...updatedFields,
    requesterId: user?.id || ''
  };

  try {
    const res = await requestApi<{ success: boolean; post: Post }>(`/api/posts/${postId}`, 'PUT', body);
    return res.post;
  } catch {
    return null;
  }
};

/**
 * Permanent removal of a lost/found report post alongside its related comments thread.
 * 
 * @param postId ID of the post
 * @returns Operation success boolean
 */
export const deletePost = async (postId: string): Promise<boolean> => {
  const user = getCurrentUser();
  try {
    const res = await requestApi<{ success: boolean }>(`/api/posts/${postId}`, 'DELETE', null, {
      'x-user-id': user?.id || ''
    });
    return res.success;
  } catch {
    return false;
  }
};

/**
 * Triggers view-count auto incrementing on the backend for analytics tracking.
 * 
 * @param postId ID of the post being viewed
 */
export const incrementViews = async (postId: string): Promise<void> => {
  try {
    await requestApi(`/api/posts/${postId}/view`, 'POST');
  } catch {
    // Fail silently on analytics telemetry
  }
};


// --- COMMENTS THREADS INTERACTORS ---

/**
 * Retrieves the message thread replies list of a particular report.
 * Ordered chronologically to match a clean forum bubble design.
 * 
 * @param postId ID of parent post report
 * @returns Array of Comments
 */
export const getCommentsForPost = async (postId: string): Promise<Comment[]> => {
  try {
    const res = await requestApi<{ success: boolean; comments: Comment[] }>(`/api/comments/${postId}`, 'GET');
    return res.comments || [];
  } catch {
    return [];
  }
};

/**
 * Adds a new comment text to the report post message list in backend database.
 * 
 * @param postId ID of parent post
 * @param author Current user model commenting
 * @param content Custom message content string
 * @returns Newly stored Comment model
 */
export const addComment = async (
  postId: string, 
  author: User, 
  content: string
): Promise<Comment> => {
  const res = await requestApi<{ success: boolean; comment: Comment }>('/api/comments', 'POST', {
    postId,
    authorId: author.id,
    content
  });
  return res.comment;
};

/**
 * Deletes a single comment answer.
 * Authorized for comment author, parent post reporter, or system administrators.
 * 
 * @param commentId Unique ID of comment
 * @returns Success indicator flag
 */
export const deleteComment = async (commentId: string): Promise<boolean> => {
  const user = getCurrentUser();
  try {
    const res = await requestApi<{ success: boolean }>(`/api/comments/${commentId}`, 'DELETE', null, {
      'x-user-id': user?.id || ''
    });
    return res.success;
  } catch {
    return false;
  }
};

/**
 * Updates user profile customization details (avatar, color, bio, name) 
 * on both backend database and local sessionStorage cache.
 */
export const updateUserProfile = async (
  userId: string,
  data: Partial<User>
): Promise<{ success: boolean; user?: User; message: string }> => {
  try {
    const res = await requestApi<{ success: boolean; user: User; message: string }>('/api/users/profile', 'PUT', {
      id: userId,
      ...data
    });
    if (res.success && res.user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(res.user));
    }
    return res;
  } catch (error: any) {
    return { success: false, message: error.message || '프로필 수정 요청에 실패했습니다.' };
  }
};

/**
 * Submits a report filing regarding an abusive/unwanted post or comment to the system administrator queue.
 */
export const submitReport = async (data: {
  targetId: string;
  targetType: 'post' | 'comment';
  targetTitleOrContent: string;
  reason: string;
  customReason?: string;
  reporterId: string;
  reporterName: string;
}): Promise<{ success: boolean; message: string }> => {
  try {
    return await requestApi<{ success: boolean; message: string }>('/api/reports', 'POST', data);
  } catch (error: any) {
    return { success: false, message: error.message || '신고 등록 처리에 실패했습니다.' };
  }
};

/**
 * Admin action to fetch all submitted user filings.
 */
export const getReports = async (adminId: string): Promise<Report[]> => {
  try {
    const res = await requestApi<{ success: boolean; reports: Report[] }>('/api/reports', 'GET', null, {
      'x-admin-id': adminId
    });
    return res.reports || [];
  } catch {
    return [];
  }
};

/**
 * Admin action to mark a report resolved.
 */
export const resolveReport = async (reportId: string, adminId: string): Promise<{ success: boolean; message: string }> => {
  try {
    return await requestApi<{ success: boolean; message: string }>(`/api/reports/${reportId}/resolve`, 'PUT', null, {
      'x-admin-id': adminId
    });
  } catch (error: any) {
    return { success: false, message: error.message || '신고 해결 처리에 실패했습니다.' };
  }
};

/**
 * Admin action to completely delete/dismiss a report entry.
 */
export const deleteReport = async (reportId: string, adminId: string): Promise<{ success: boolean; message: string }> => {
  try {
    return await requestApi<{ success: boolean; message: string }>(`/api/reports/${reportId}`, 'DELETE', null, {
      'x-admin-id': adminId
    });
  } catch (error: any) {
    return { success: false, message: error.message || '신고 반려 처리에 실패했습니다.' };
  }
};
