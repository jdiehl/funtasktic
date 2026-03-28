import { FormEvent, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { authedRequest, request } from '@/lib/api/client';

interface UseMvpAuthReturn {
  user: User | null;
  loading: boolean;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  displayName: string;
  setDisplayName: (name: string) => void;
  authBusy: boolean;
  message: string | null;
  setMessage: (msg: string | null) => void;
  handleSignIn: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleSignUp: () => Promise<void>;
  handleSignOut: () => Promise<void>;
}

/**
 * Custom hook managing authentication state and operations
 */
export function useMvpAuth(): UseMvpAuthReturn {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Refresh session on auth state changes
  useEffect(() => {
    if (!user) {
      return;
    }

    return onIdTokenChanged(auth, async (updatedUser) => {
      if (!updatedUser) {
        return;
      }

      try {
        const idToken = await updatedUser.getIdToken();
        await request<{ success: boolean }>('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } catch {
        // Session refresh failure should not block the local app state.
      }
    });
  }, [user]);

  async function finalizeAuth(nextDisplayName?: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    const idToken = await currentUser.getIdToken(true);

    await request<{ success: boolean }>('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    await authedRequest<{ success: boolean }>(currentUser, '/api/users/bootstrap', {
      method: 'POST',
    });

    if (nextDisplayName && nextDisplayName.trim().length > 0) {
      const normalized = nextDisplayName.trim();
      await updateProfile(currentUser, { displayName: normalized });
      await authedRequest<{ success: boolean }>(currentUser, `/api/users/${currentUser.uid}`, {
        method: 'PATCH',
        body: JSON.stringify({ displayName: normalized }),
      });
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setMessage(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      await finalizeAuth();
      setMessage('Signed in. Ready to tackle chores.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignUp() {
    setAuthBusy(true);
    setMessage(null);

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      await finalizeAuth(displayName);
      setMessage('Account created. Personal list is ready.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create account');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    setAuthBusy(true);
    setMessage(null);

    try {
      await request<{ success: boolean }>('/api/auth/session', { method: 'DELETE' });
      await signOut(auth);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign out');
    } finally {
      setAuthBusy(false);
    }
  }

  return {
    user,
    loading,
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    authBusy,
    message,
    setMessage,
    handleSignIn,
    handleSignUp,
    handleSignOut,
  };
}

// Import useAuth from existing hook
function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return auth.onAuthStateChanged((user) => {
      setUser(user ?? null);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}
