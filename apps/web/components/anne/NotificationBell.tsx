'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Package, Truck, CheckCircle2, AlertCircle, Archive, Clock } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  shipment_id?: string;
  metadata?: Record<string, unknown>;
}

// Icone e colori per tipi tracking
const TRACKING_NOTIFICATION_CONFIG: Record<
  string,
  { icon: typeof Bell; color: string; bgColor: string }
> = {
  shipment_delivered: { icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
  giacenza_detected: { icon: Archive, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  delivery_failed: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-50' },
  tracking_out_for_delivery: { icon: Truck, color: 'text-blue-500', bgColor: 'bg-blue-50' },
  tracking_exception: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-50' },
};

// Barra colore laterale per tipo
const TYPE_BAR_COLORS: Record<string, string> = {
  shipment_delivered: 'bg-emerald-500',
  giacenza_detected: 'bg-amber-500',
  delivery_failed: 'bg-red-500',
  tracking_out_for_delivery: 'bg-blue-500',
  tracking_exception: 'bg-red-500',
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/support/notifications?limit=10');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        const newNotifications = data.notifications || [];
        const newUnread =
          data.unreadCount ?? newNotifications.filter((n: Notification) => !n.read).length ?? 0;

        // Rileva nuova notifica per animazione campanella
        if (newUnread > prevUnreadRef.current && prevUnreadRef.current >= 0) {
          setHasNewNotification(true);
          // Reset animazione dopo 2s
          setTimeout(() => setHasNewNotification(false), 2000);
        }
        prevUnreadRef.current = newUnread;

        setNotifications(newNotifications);
        setUnreadCount(newUnread);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000); // Poll ogni 30s

    // Ascolta evento custom per refetch immediato (da pagina spedizioni)
    const handleTrackingNotification = () => {
      // Ritardo minimo per dare tempo al DB di persistere la notifica
      setTimeout(fetchNotifications, 1000);
    };
    window.addEventListener('tracking-notification', handleTrackingNotification);

    return () => {
      clearInterval(interval);
      window.removeEventListener('tracking-notification', handleTrackingNotification);
    };
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      const res = await fetch('/api/support/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, read: true }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Silently fail
    }
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/support/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m fa`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h fa`;
    return `${Math.floor(hours / 24)}g fa`;
  };

  const isTrackingType = (type: string) => type in TRACKING_NOTIFICATION_CONFIG;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors duration-200 ${
          hasNewNotification ? 'animate-[bellShake_0.6s_ease-in-out]' : ''
        }`}
        title="Notifiche"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[340px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">Notifiche</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50"
              >
                Segna tutte come lette
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">Nessuna notifica</div>
            ) : (
              notifications.map((n) => {
                const trackingConfig = TRACKING_NOTIFICATION_CONFIG[n.type];
                const barColor = TYPE_BAR_COLORS[n.type];
                const IconComponent = trackingConfig?.icon || Bell;
                const trackingNumber = (n.metadata?.tracking_number as string) || '';
                const carrier = ((n.metadata?.carrier as string) || '').toUpperCase();

                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markAsRead(n.id)}
                    className={`flex overflow-hidden border-b border-gray-50 last:border-0 cursor-pointer transition-colors duration-150 ${
                      !n.read
                        ? trackingConfig?.bgColor
                          ? `${trackingConfig.bgColor}/50`
                          : 'bg-orange-50/50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Barra colore laterale per tracking */}
                    {barColor && <div className={`w-1 flex-shrink-0 ${barColor}`} />}

                    <div className="flex items-start gap-3 px-3 py-3 flex-1">
                      {/* Icona */}
                      <div
                        className={`flex-shrink-0 mt-0.5 ${trackingConfig?.color || 'text-gray-400'}`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>

                      {/* Contenuto */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 leading-snug">{n.message}</p>

                        {/* Tracking number + carrier per notifiche tracking */}
                        {isTrackingType(n.type) && trackingNumber && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-mono text-gray-500 truncate">
                              {trackingNumber}
                            </span>
                            {carrier && (
                              <span className="px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 rounded">
                                {carrier}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">{formatTime(n.created_at)}</span>
                          {!n.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CSS per animazione campanella */}
      <style jsx>{`
        @keyframes bellShake {
          0% {
            transform: rotate(0deg);
          }
          15% {
            transform: rotate(14deg);
          }
          30% {
            transform: rotate(-12deg);
          }
          45% {
            transform: rotate(10deg);
          }
          60% {
            transform: rotate(-8deg);
          }
          75% {
            transform: rotate(4deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
      `}</style>
    </div>
  );
}
