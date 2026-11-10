# Windows document expiry notifications

Rakeza HR's Windows desktop build can monitor company and employee documents
and show native Windows notifications at the 45, 30, 15, and 7 day reminders.

## How it works

- Notifications are enabled by default on standalone and database-host installs.
- The packaged app registers itself to start when the signed-in Windows user logs
  in. It starts hidden, checks immediately, then checks once per hour.
- Closing the window hides Rakeza HR in the Windows notification area. Use the
  tray menu to reopen it, pause reminders, or quit.
- The monitor reads only document identifiers, category, and expiry dates from
  the local API. Toasts show counts and never include employee names or IDs.
- A per-install random secret protects the local notification endpoint. Sent
  reminders are remembered locally to avoid repeating the same threshold alert.
- On client installs, alerts run on the database-host computer. A client device
  does not independently monitor the shared database while its app is closed.

## Windows behavior and limits

Windows notifications require the Windows user session to be signed in and the
computer to be awake and connected to the local database. Notifications cannot
appear while Windows is logged out, the computer is shut down, or the app has
been quit from its tray menu. On the next sign-in/start, the monitor checks
immediately and catches up on any current reminder thresholds.

The user can turn notifications off in **Settings → Windows document expiry
alerts**. Windows notification settings and Focus/Do Not Disturb may also hide
or silence the toast. The app's tray/background integration and packaged Windows
toast behavior still need validation on a real Windows installation; the source
build check alone does not exercise Windows notification delivery.
