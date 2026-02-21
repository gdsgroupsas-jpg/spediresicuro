/**
 * Modal per inserire OTP manuale (Microsoft Authenticator)
 *
 * Usato durante sync manuale quando 2FA method è 'manual'
 */

'use client';

import { useState, useEffect } from 'react';

interface OTPInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (otp: string) => void;
  title?: string;
  message?: string;
}

export function OTPInputModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Inserisci Codice OTP',
  message = 'Apri Microsoft Authenticator e inserisci il codice a 6 cifre:',
}: OTPInputModalProps) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Valida OTP (6 cifre)
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setError('Inserisci un codice OTP valido (6 cifre)');
      return;
    }

    onConfirm(otp);
    setOtp('');
    setError('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">{title}</h2>

        <p className="text-gray-600 mb-4">{message}</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Codice OTP (6 cifre)</label>
            <input
              type="text"
              value={otp}
              onChange={handleChange}
              className="w-full border rounded px-4 py-3 text-2xl text-center tracking-widest font-mono"
              placeholder="000000"
              maxLength={6}
              autoFocus
              pattern="\d{6}"
            />
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={otp.length !== 6}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Conferma
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
