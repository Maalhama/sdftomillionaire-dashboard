'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ backgroundColor: '#0a0a0a', color: '#e0e0e0', fontFamily: 'monospace' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '1rem' }}>{'>'}_</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
              Erreur critique
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '1.5rem' }}>
              {error.message || 'L\'application a rencontré une erreur fatale.'}
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#00ff41',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: '0.375rem',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Recharger
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
