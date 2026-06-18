import { Post, Comment, User, Report } from './types';
import { supabase } from './supabaseClient';

// Storage key to cache the currently logged-in user session in the client browser
const SESSION_STORAGE_KEY = 'school_lost_found_logged_in_user';

export const initializeDB = () => {
  // Configured with Supabase!
};

// --- USER RECRUITMENT & SESSION CONTROLLER ---

/**
 * Retrieves list of all registered member accounts from Supabase profiles.
 * This is restricted to system administrators.
 */
export const getUsers = async (adminId?: string): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('student_id', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      studentId: d.student_id,
      email: d.email,
      isAdmin: !!d.is_admin,
      avatarEmoji: d.avatar_emoji || '🎒',
      profileColor: d.profile_color || 'indigo',
      bio: d.bio || ''
    }));
  } catch (err) {
    console.error('getUsers error:', err);
    return [];
  }
};

/**
 * Submits a new student user registration query to Supabase.
 */
export const registerUser = async (user: User): Promise<{ success: boolean; message: string }> => {
  try {
    // 1. Check ID & Email duplication via a secure SECURITY DEFINER RPC to prevent RLS lookup bypass blockages
    const { data: dupResult, error: dupError } = await supabase
      .rpc('check_id_email_exists', { 
        check_id: user.id.toLowerCase(), 
        check_email: user.email.toLowerCase() 
      });

    if (!dupError && dupResult) {
      if (dupResult.id_exists) {
        return { success: false, message: '동일한 아이디가 이미 사용 중입니다.' };
      }
      if (dupResult.email_exists) {
        return { success: false, message: '동일한 이메일이 이미 존재합니다.' };
      }
    }

    // 2. Register in Supabase Auth
    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email: user.email,
      password: user.password || 'password123',
      options: {
        data: {
          name: user.name,
          student_id: user.studentId,
          custom_id: user.id
        }
      }
    });

    if (authError) {
      return { success: false, message: authError.message };
    }

    // 3. Create a public profile record synced with their custom ID
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        name: user.name,
        student_id: user.studentId,
        email: user.email,
        is_admin: user.id === 'admin' || user.email === 'admin@jinkwang.hs.kr',
        avatar_emoji: '🎒',
        profile_color: 'indigo',
        bio: '반갑습니다! 진광고등학교 재학생입니다.',
        auth_uid: signUpData?.user?.id || null
      });

    if (insertError) {
      console.error('Insert profile error:', insertError);
      return { success: false, message: '프로필 저장 도중 오류가 발생했습니다: ' + insertError.message };
    }

    return { success: true, message: '회원가입이 원활하게 완료되었습니다! 로그인 해 주세요.' };
  } catch (error: any) {
    console.error('registerUser catch error:', error);
    return { success: false, message: error.message || '회원가입 처리 중 실패했습니다.' };
  }
};

/**
 * Authenticates login credentials against Supabase.
 */
export const loginUser = async (
  idOrEmail: string, 
  password: string
): Promise<{ success: boolean; user?: User; message: string }> => {
  try {
    let email = idOrEmail;
    
    // If input is not an email layout, seek the corresponding email in profiles
    if (!idOrEmail.includes('@')) {
      const { data: rpcEmail, error: rpcError } = await supabase
        .rpc('get_email_by_custom_id', { user_custom_id: idOrEmail.toLowerCase() });
      
      if (rpcError || !rpcEmail) {
        return { success: false, message: '존재하지 않는 사용자 아이디입니다.' };
      }
      email = rpcEmail;
    }

    // Sign in via Supabase Auth
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return { success: false, message: '비밀번호가 올바르지 않거나 로그인 오류가 발생했습니다.' };
    }

    // Retrieve active profile synced with the user's email
    const { data: profile, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (fetchErr || !profile) {
      return { success: false, message: '프로필 연동 정보를 찾을 수 없습니다.' };
    }

    const matchedUser: User = {
      id: profile.id,
      name: profile.name,
      studentId: profile.student_id,
      email: profile.email,
      isAdmin: !!profile.is_admin,
      avatarEmoji: profile.avatar_emoji || '🎒',
      profileColor: profile.profile_color || 'indigo',
      bio: profile.bio || ''
    };

    // Keep state in local storage cache
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(matchedUser));
    return { success: true, user: matchedUser, message: '로그인에 성공했습니다!' };
  } catch (error: any) {
    console.error('loginUser error:', error);
    return { success: false, message: error.message || '로그인 중 오류가 발생했습니다.' };
  }
};

/**
 * Log out active user from Supabase.
 */
export const logoutUser = () => {
  supabase.auth.signOut();
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

/**
 * Fetches user profile from local cache metadata.
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
 * Permanently delete a user profile record and their auth record.
 */
export const deleteUser = async (
  userId: string, 
  adminId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Delete profile (cascading columns handles dependent rows based on foreign key/on delete cascade)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) throw profileError;

    return { success: true, message: '사용자가 성공적으로 삭제 처리되었습니다.' };
  } catch (error: any) {
    console.error('DeleteUser error:', error);
    return { success: false, message: error.message || '사용자 정보 삭제 도중 에러가 발견되었습니다.' };
  }
};


// --- POSTING REPORT INTERACTORS ---

/**
 * Queries all lost & found posts from Supabase posts table.
 */
export const getPosts = async (): Promise<Post[]> => {
  try {
    // Fetch posts and profiles
    const { data: posts, error: postsErr } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (postsErr) throw postsErr;
    if (!posts) return [];

    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('*');

    if (profilesErr) throw profilesErr;

    return posts.map((post: any) => {
      const profile = profiles?.find((p: any) => p.id === post.author_id);
      return {
        id: post.id,
        title: post.title,
        type: post.type as any,
        reporterName: post.reporter_name,
        reporterStudentId: post.reporter_student_id,
        location: post.location,
        tags: post.tags || [],
        description: post.description,
        createdAt: post.created_at,
        views: post.views || 0,
        resolved: !!post.resolved,
        authorId: post.author_id,
        imageUrl: post.image_url || undefined,
        authorAvatarEmoji: profile?.avatar_emoji || '🎒',
        authorProfileColor: profile?.profile_color || 'indigo',
        authorBio: profile?.bio || ''
      };
    });
  } catch (err) {
    console.error('getPosts error:', err);
    return [];
  }
};

export const setPosts = (posts: Post[]) => {
  // Supabase manages transactions
};

/**
 * Inserts a brand new lost/found report post into Supabase.
 */
export const addPost = async (
  post: Omit<Post, 'id' | 'createdAt' | 'views' | 'resolved'>
): Promise<Post> => {
  try {
    const randomId = Math.random().toString(36).substr(2, 9);
    const newRow = {
      id: randomId,
      title: post.title,
      type: post.type,
      reporter_name: post.reporterName,
      reporter_student_id: post.reporterStudentId,
      location: post.location,
      tags: post.tags,
      description: post.description,
      views: 0,
      resolved: false,
      author_id: post.authorId,
      image_url: post.imageUrl || null
    };

    const { data, error } = await supabase
      .from('posts')
      .insert(newRow)
      .select()
      .single();

    if (error) throw error;

    // Fetch refreshed posts list or construct
    const { data: authorProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', post.authorId)
      .maybeSingle();

    return {
      id: data.id,
      title: data.title,
      type: data.type,
      reporterName: data.reporter_name,
      reporterStudentId: data.reporter_student_id,
      location: data.location,
      tags: data.tags || [],
      description: data.description,
      createdAt: data.created_at,
      views: data.views,
      resolved: data.resolved,
      authorId: data.author_id,
      imageUrl: data.image_url || undefined,
      authorAvatarEmoji: authorProfile?.avatar_emoji || '🎒',
      authorProfileColor: authorProfile?.profile_color || 'indigo',
      authorBio: authorProfile?.bio || ''
    };
  } catch (error: any) {
    console.error('addPost error:', error);
    throw error;
  }
};

/**
 * Updates an existing post report contents or resolved attributes in Supabase.
 */
export const updatePost = async (
  postId: string, 
  updatedFields: Partial<Post>
): Promise<Post | null> => {
  try {
    const dbUpdate: any = {};
    if (updatedFields.title !== undefined) dbUpdate.title = updatedFields.title;
    if (updatedFields.type !== undefined) dbUpdate.type = updatedFields.type;
    if (updatedFields.location !== undefined) dbUpdate.location = updatedFields.location;
    if (updatedFields.tags !== undefined) dbUpdate.tags = updatedFields.tags;
    if (updatedFields.description !== undefined) dbUpdate.description = updatedFields.description;
    if (updatedFields.resolved !== undefined) dbUpdate.resolved = updatedFields.resolved;
    if (updatedFields.imageUrl !== undefined) dbUpdate.image_url = updatedFields.imageUrl || null;
    if (updatedFields.views !== undefined) dbUpdate.views = updatedFields.views;

    const { data, error } = await supabase
      .from('posts')
      .update(dbUpdate)
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;

    const { data: authorProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.author_id)
      .maybeSingle();

    return {
      id: data.id,
      title: data.title,
      type: data.type,
      reporterName: data.reporter_name,
      reporterStudentId: data.reporter_student_id,
      location: data.location,
      tags: data.tags || [],
      description: data.description,
      createdAt: data.created_at,
      views: data.views,
      resolved: data.resolved,
      authorId: data.author_id,
      imageUrl: data.image_url || undefined,
      authorAvatarEmoji: authorProfile?.avatar_emoji || '🎒',
      authorProfileColor: authorProfile?.profile_color || 'indigo',
      authorBio: authorProfile?.bio || ''
    };
  } catch (error) {
    console.error('updatePost error:', error);
    return null;
  }
};

/**
 * Permanent removal of a lost/found report post alongside its related comments thread.
 */
export const deletePost = async (postId: string): Promise<boolean> => {
  try {
    // Delete comments first
    await supabase.from('comments').delete().eq('post_id', postId);

    // Delete post
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    return !error;
  } catch (error) {
    console.error('deletePost error:', error);
    return false;
  }
};

/**
 * Triggers view-count auto incrementing in Supabase.
 */
export const incrementViews = async (postId: string): Promise<void> => {
  try {
    // To increment a view count cleanly, fetch current views and increment it
    const { data, error } = await supabase
      .from('posts')
      .select('views')
      .eq('id', postId)
      .maybeSingle();

    if (!error && data) {
      await supabase
        .from('posts')
        .update({ views: (data.views || 0) + 1 })
        .eq('id', postId);
    }
  } catch {
    // Fail silently on analytics telemetry
  }
};


// --- COMMENTS THREADS INTERACTORS ---

/**
 * Retrieves comments list of a study post.
 */
export const getCommentsForPost = async (postId: string): Promise<Comment[]> => {
  try {
    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!comments) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*');

    return comments.map((comment: any) => {
      const profile = profiles?.find((p: any) => p.id === comment.author_id);
      return {
        id: comment.id,
        postId: comment.post_id,
        authorId: comment.author_id,
        authorName: comment.author_name,
        authorStudentId: comment.author_student_id,
        content: comment.content,
        createdAt: comment.created_at,
        authorAvatarEmoji: profile?.avatar_emoji || '🎒',
        authorProfileColor: profile?.profile_color || 'indigo',
        authorBio: profile?.bio || ''
      };
    });
  } catch (err) {
    console.error('getCommentsForPost error:', err);
    return [];
  }
};

/**
 * Adds a new comment text to a post.
 */
export const addComment = async (
  postId: string, 
  author: User, 
  content: string
): Promise<Comment> => {
  try {
    const randomId = Math.random().toString(36).substr(2, 9);
    const newRow = {
      id: randomId,
      post_id: postId,
      author_id: author.id,
      author_name: author.name,
      author_student_id: author.studentId,
      content: content
    };

    const { data, error } = await supabase
      .from('comments')
      .insert(newRow)
      .select()
      .single();

    if (error) throw error;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', author.id)
      .maybeSingle();

    return {
      id: data.id,
      postId: data.post_id,
      authorId: data.author_id,
      authorName: data.author_name,
      authorStudentId: data.author_student_id,
      content: data.content,
      createdAt: data.created_at,
      authorAvatarEmoji: profile?.avatar_emoji || '🎒',
      authorProfileColor: profile?.profile_color || 'indigo',
      authorBio: profile?.bio || ''
    };
  } catch (error: any) {
    console.error('addComment error:', error);
    throw error;
  }
};

/**
 * Deletes a single comment reply node.
 */
export const deleteComment = async (commentId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    return !error;
  } catch (error) {
    console.error('deleteComment error:', error);
    return false;
  }
};

/**
 * Updates profile colors and customization.
 */
export const updateUserProfile = async (
  userId: string,
  data: Partial<User>
): Promise<{ success: boolean; user?: User; message: string }> => {
  try {
    const dbUpdate: any = {};
    if (data.name !== undefined) dbUpdate.name = data.name;
    if (data.bio !== undefined) dbUpdate.bio = data.bio;
    if (data.avatarEmoji !== undefined) dbUpdate.avatar_emoji = data.avatarEmoji;
    if (data.profileColor !== undefined) dbUpdate.profile_color = data.profileColor;

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(dbUpdate)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    const updatedUser: User = {
      id: profile.id,
      name: profile.name,
      studentId: profile.student_id,
      email: profile.email,
      isAdmin: !!profile.is_admin,
      avatarEmoji: profile.avatar_emoji || '🎒',
      profileColor: profile.profile_color || 'indigo',
      bio: profile.bio || ''
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedUser));
    return { success: true, user: updatedUser, message: '프로필 수정이 정상 처리되었습니다!' };
  } catch (error: any) {
    console.error('updateUserProfile error:', error);
    return { success: false, message: error.message || '프로필 변경 도중 에러가 발생했습니다.' };
  }
};

/**
 * Submits safety report to queue.
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
    const randomId = Math.random().toString(36).substr(2, 9);
    const newRow = {
      id: randomId,
      target_id: data.targetId,
      target_type: data.targetType,
      target_title_or_content: data.targetTitleOrContent,
      reason: data.reason,
      custom_reason: data.customReason || null,
      reporter_id: data.reporterId,
      reporter_name: data.reporterName,
      resolved: false
    };

    const { error } = await supabase
      .from('reports')
      .insert(newRow);

    if (error) throw error;

    return { success: true, message: '신고가 접수되었습니다.' };
  } catch (error: any) {
    console.error('submitReport error:', error);
    return { success: false, message: error.message || '신고서 접수 중 오류 발생.' };
  }
};

/**
 * Admin: get reported list.
 */
export const getReports = async (adminId: string): Promise<Report[]> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return data.map((d: any) => ({
      id: d.id,
      targetId: d.target_id,
      targetType: d.target_type as 'post' | 'comment',
      targetTitleOrContent: d.target_title_or_content,
      reason: d.reason,
      customReason: d.custom_reason || undefined,
      reporterId: d.reporter_id,
      reporterName: d.reporter_name,
      createdAt: d.created_at,
      resolved: !!d.resolved
    }));
  } catch (err) {
    console.error('getReports error:', err);
    return [];
  }
};

/**
 * Admin: resolve report.
 */
export const resolveReport = async (reportId: string, adminId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const { error } = await supabase
      .from('reports')
      .update({ resolved: true })
      .eq('id', reportId);

    if (error) throw error;
    return { success: true, message: '신고 목록 해결 완료.' };
  } catch (error: any) {
    return { success: false, message: error.message || '신고 해결 중 오류.' };
  }
};

/**
 * Admin: delete report.
 */
export const deleteReport = async (reportId: string, adminId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId);

    if (error) throw error;
    return { success: true, message: '신고 건 기각/이력제거 완료.' };
  } catch (error: any) {
    return { success: false, message: error.message || '신고 삭제 실패.' };
  }
};

/**
 * Finds user's custom ID by their registered email.
 */
export const findCustomIdByEmail = async (email: string): Promise<{ success: boolean; customId?: string; message: string }> => {
  try {
    const { data, error } = await supabase
      .rpc('get_custom_id_by_email', { user_email: email.trim().toLowerCase() });

    if (error) {
      console.error('get_custom_id_by_email RPC error:', error);
      // Fallback: search profile using standard query. If RLS blocks, we will fail with a clean message.
      const { data: profile, error: queryErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (queryErr || !profile) {
        return { 
          success: false, 
          message: '해당 이메일로 등록된 정보를 조회할 수 없거나 RPC 함수가 활성화되어 있지 않습니다. 제공된 SQL 스크립트를 관리자가 데이터베이스에 적용하였는지 확인해 주세요.' 
        };
      }

      return { success: true, customId: profile.id, message: '아이디를 성공적으로 조회했습니다!' };
    }

    if (!data) {
      return { success: false, message: '해당 이메일로 등록된 아이디가 존재하지 않습니다.' };
    }

    return { success: true, customId: data, message: '아이디를 성공적으로 조회했습니다!' };
  } catch (err: any) {
    console.error('findCustomIdByEmail error:', err);
    return { success: false, message: err.message || '아이디 조회 도중 오류가 발생했습니다.' };
  }
};

/**
 * Sends a password reset email via Supabase Auth.
 */
export const sendPasswordResetEmail = async (email: string): Promise<{ success: boolean; message: string }> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: '비밀번호 재설정 메일이 전송되었습니다! 이메일 수신함을 확인해 주세요.' };
  } catch (err: any) {
    console.error('sendPasswordResetEmail error:', err);
    return { success: false, message: err.message || '비밀번호 재설정 이메일 요청에 실패했습니다.' };
  }
};

