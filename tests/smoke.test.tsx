import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// App kini memuat supabase client via router; client melempar Error bila
// env kosong, jadi mock modulnya agar test tidak butuh env asli.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

import App from '@/App';

describe('App', () => {
  it('merender aplikasi tanpa error dan mengalihkan ke login', async () => {
    render(<App />);
    // Session null → role null → HomeRedirect mengalihkan ke /login.
    expect(
      await screen.findByRole('heading', { name: /masuk/i }),
    ).toBeInTheDocument();
  });
});
