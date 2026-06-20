/* ============================================================
   Macro — weigh-in reminders (notifications + .ics calendar)
   ============================================================ */
window.App = window.App || {};

App.Reminders = (function () {
  const Store = App.Store, UI = App.UI;
  let timer = null;

  function enabled() { return !!Store.profile().reminders; }

  async function requestPermission() {
    if (!('Notification' in window)) {
      UI.toast('Notifications not supported here');
      return false;
    }
    if (Notification.permission === 'granted') return true;
    const res = await Notification.requestPermission();
    return res === 'granted';
  }

  // Should we be nagging right now? (past weigh-in time, nothing logged today)
  function isDue() {
    if (!enabled()) return false;
    if (Store.weightToday() != null) return false;
    const [h, m] = Store.profile().weighInTime.split(':').map(Number);
    const now = new Date();
    return (now.getHours() > h) || (now.getHours() === h && now.getMinutes() >= m);
  }

  function fire() {
    if (!isDue()) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('⚖️ Time to weigh in', {
          body: 'Log tonight\'s weight so Macro can adjust your plan.',
          icon: 'icons/icon-180.png', tag: 'macro-weighin'
        });
      } catch (e) { /* some iOS contexts throw */ }
    }
  }

  // While the app is open, check on an interval and at the scheduled minute.
  function start() {
    stop();
    // fire shortly after open if already due
    setTimeout(fire, 1500);
    timer = setInterval(() => {
      const [h, m] = Store.profile().weighInTime.split(':').map(Number);
      const now = new Date();
      if (now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 60) fire();
    }, 30000);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  /* ---------- .ics: reliable daily iPhone Calendar reminder ---------- */
  function downloadICS() {
    const [h, m] = Store.profile().weighInTime.split(':').map(Number);
    const dt = `${String(h).padStart(2,'0')}${String(m).padStart(2,'0')}00`;
    const today = new Date();
    const stamp = today.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
    const start = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}T${dt}`;
    const ics = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Macro//Weigh-In//EN','CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:macro-weighin-${Date.now()}@macro.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      'RRULE:FREQ=DAILY',
      'SUMMARY:⚖️ Macro Weigh-In',
      'DESCRIPTION:Step on the scale and log it in Macro. Track the trend\\, adjust the plan.',
      'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Weigh in now','TRIGGER:PT0M','END:VALARM',
      'END:VEVENT','END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'macro-weigh-in.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.toast('Opening calendar reminder…');
  }

  return { enabled, requestPermission, isDue, fire, start, stop, downloadICS };
})();
