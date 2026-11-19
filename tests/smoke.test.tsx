import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '@/App';

describe('App', () => {
  it('merender judul aplikasi', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /absensi guru/i })).toBeInTheDocument();
  });
});
