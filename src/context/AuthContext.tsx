import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiGetMe, apiLogin, apiRegister } from '../lib/api';
import { emailHandle, getDisplayName } from '../lib/display';

export type UserRole = 'SEEKER' | 'EMPLOYER' | 'FREELANCER' | 'ADMIN';

interface JobSeekerProfile {
  firstName?: string | null;
  lastName?: string | null;
  skills?: string | null;
  experience?: string | null;
  resumeFileUrl?: string | null;
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
  email: string;
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
  signup: (email: string, password: string, role: UserRole) => Promise<void>;
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
    persistToken(data.token);

    try {
      await syncCurrentUser();
    } catch {
      const fallbackUser = data.user as AuthUser;
      setUser(fallbackUser);
      setIsOnboarded(hasCompletedOnboarding(fallbackUser));
    }
  };

  const signup = async (email: string, password: string, role: UserRole) => {
    const data = await apiRegister(email, password, role);
    persistToken(data.token);

    try {
      await syncCurrentUser();
    } catch {
      setUser(data.user as AuthUser);
      setIsOnboarded(false);
    }
  };

  const logout = () => {
    clearSession();
  };

  const refreshUser = async () => {
    await syncCurrentUser();
  };

  const userName =
    user?.role === 'EMPLOYER'
      ? user.employerProfile?.companyName || emailHandle(user.email)
      : getDisplayName(
          user?.jobSeekerProfile?.firstName || user?.freelancerProfile?.firstName,
          user?.jobSeekerProfile?.lastName || user?.freelancerProfile?.lastName,
          user?.email,
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
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
