import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import styles from './InstallPrompt.module.css';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS instructions after a delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Listen for beforeinstallprompt (Chrome, Edge, etc.)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className={styles.prompt}>
      <div className={styles.content}>
        <div className={styles.icon}>
          <Download size={24} />
        </div>
        <div className={styles.text}>
          <strong>Installer EasyWork</strong>
          {isIOS ? (
            <p>
              Trykk på <span className={styles.shareIcon}>⬆️</span> og velg "Legg til på Hjem-skjerm"
            </p>
          ) : (
            <p>Få rask tilgang fra skrivebordet</p>
          )}
        </div>
      </div>
      <div className={styles.actions}>
        {!isIOS && (
          <button className={styles.installBtn} onClick={handleInstall}>
            Installer
          </button>
        )}
        <button className={styles.closeBtn} onClick={handleDismiss} aria-label="Lukk">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
