import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiGetMe, apiGoogleAuth, apiLogin, apiLoginWithPhone, apiRegister, apiSignupWithPhone } from '../lib/api';
import { emailHandle, getDisplayName } from '../lib/display';
import { queryClient } from '../lib/queryClient';

export type UserRole = 'SEEKER' | 'EMPLOYER' | 'FREELANCER' | 'ADMIN';

interface JobSeekerProfile {
  careerStage?: string | null;
  institution?: string | null;
  programme?: string | null;
  completionYear?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  skills?: string | null;
  experience?: string | null;
  resumeFileUrl?: string | null;
  cvVisibility?: 'HIDDEN' | 'VERIFIED_EMPLOYERS';
  headline?: string | null;
  location?: string | null;
  educationLevel?: string | null;
  availability?: string | null;
  yearsExperience?: number | null;
  jobCategory?: string | null;
  profileBoostedUntil?: string | null;
}

interface EmployerProfile {
  companyName?: string | null;
  industry?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  description?: string | null;
}

interface FreelancerProfile {
  firstName?: string | null;
  lastName?: string | null;
  hourlyRate?: number | null;
  portfolioUrl?: string | null;
  bio?: string | null;
  skills?: string | null;
}

export interface AuthUser {
  id: string;
  // Empty for people who signed up with just a phone number.
  email: string | null;
  phone?: string | null;
  role: UserRole;
  emailVerified?: boolean;
  verificationStatus?: string | null;
  verificationType?: string | null;
  isVerified?: boolean;
  jobSeekerProfile?: JobSeekerProfile | null;
  employerProfile?: EmployerProfile | null;
  freelancerProfile?: FreelancerProfile | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isOnboarded: boolean;
  userName: string;
  userEmail: string;
  role: UserRole | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role: UserRole, captchaToken?: string, options?: { cvVisibility?: 'HIDDEN' | 'VERIFIED_EMPLOYERS' }) => Promise<void>;
  loginWithPhone: (phone: string, code: string) => Promise<void>;
  signupWithPhone: (phone: string, code: string, role: UserRole) => Promise<void>;
  /** Log in (or sign up) with a Google ID token. Says whether the account is new. */
  continueWithGoogle: (credential: string, role?: 'SEEKER' | 'EMPLOYER') => Promise<{ isNew: boolean }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getStoredToken = () => localStorage.getItem('jobwahala_token');

const hasCompletedOnboarding = (user: AuthUser | null) => {
  if (!user) return false;

  if (user.role === 'ADMIN') return true;

  if (user.role === 'SEEKER') {
    return Boolean(
      user.jobSeekerProfile?.firstName ||
        user.jobSeekerProfile?.lastName ||
        user.jobSeekerProfile?.experience ||
        user.jobSeekerProfile?.skills,
    );
  }

  if (user.role === 'EMPLOYER') {
    return Boolean(
      user.employerProfile?.companyName &&
        user.employerProfile.companyName !== 'New Company',
    );
  }

  return Boolean(
    user.freelancerProfile?.firstName ||
      user.freelancerProfile?.lastName ||
      user.freelancerProfile?.bio ||
      user.freelancerProfile?.skills,
  );
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  const persistToken = (nextToken: string) => {
    localStorage.setItem('jobwahala_token', nextToken);
    setToken(nextToken);
  };

  const clearSession = () => {
    // Dashboard data is cached per screen, not per person. Drop it all so the next account never sees this one's numbers.
    queryClient.clear();
    setUser(null);
    setToken(null);
    setIsOnboarded(false);
    localStorage.removeItem('jobwahala_token');
  };

  const syncCurrentUser = async () => {
    const data = await apiGetMe();
    const nextUser = data.user as AuthUser;

    setUser(nextUser);
    setIsOnboarded(hasCompletedOnboarding(nextUser));
  };

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state reset or fetch kicked off when inputs change
      setIsLoading(false);
      return;
    }

    syncCurrentUser()
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  const login = async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    queryClient.clear();
    persistToken(data.token);

    try {
      await syncCurrentUser();
    } catch {
      const fallbackUser = data.user as AuthUser;
      setUser(fallbackUser);
      setIsOnboarded(hasCompletedOnboarding(fallbackUser));
    }
  };

  const signup = async (email: string, password: string, role: UserRole, captchaToken?: string, options?: { cvVisibility?: 'HIDDEN' | 'VERIFIED_EMPLOYERS' }) => {
    queryClient.clear();
    const data = options ? await apiRegister(email, password, role, captchaToken, options) : captchaToken ? await apiRegister(email, password, role, captchaToken) : await apiRegister(email, password, role);
    persistToken(data.token);

    try {
      await syncCurrentUser();
    } catch {
      setUser(data.user as AuthUser);
      setIsOnboarded(false);
    }
  };

  const startSession = async (data: { token: string; user: AuthUser }, isNewAccount: boolean) => {
    // Signing in as someone else on the same browser must start from an empty cache too.
    queryClient.clear();
    persistToken(data.token);

    try {
      await syncCurrentUser();
    } catch {
      setUser(data.user);
      setIsOnboarded(isNewAccount ? false : hasCompletedOnboarding(data.user));
    }
  };

  const loginWithPhone = async (phone: string, code: string) => {
    await startSession(await apiLoginWithPhone(phone, code), false);
  };

  const signupWithPhone = async (phone: string, code: string, role: UserRole) => {
    await startSession(await apiSignupWithPhone(phone, code, role), true);
  };

  const continueWithGoogle = async (credential: string, role?: 'SEEKER' | 'EMPLOYER') => {
    const data = await apiGoogleAuth(credential, role);
    await startSession(data, Boolean(data.isNew));
    return { isNew: Boolean(data.isNew) };
  };

  const logout = () => {
    clearSession();
  };

  const refreshUser = async () => {
    await syncCurrentUser();
  };

  const userName =
    user?.role === 'EMPLOYER'
      ? user.employerProfile?.companyName || emailHandle(user.email ?? user.phone)
      : getDisplayName(
          user?.jobSeekerProfile?.firstName || user?.freelancerProfile?.firstName,
          user?.jobSeekerProfile?.lastName || user?.freelancerProfile?.lastName,
          user?.email ?? user?.phone,
        );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isOnboarded,
        userName,
        userEmail: user?.email || '',
        role: user?.role || null,
        login,
        signup,
        loginWithPhone,
        signupWithPhone,
        logout,
        continueWithGoogle,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook is co-located with its provider; tests mock this module path
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
