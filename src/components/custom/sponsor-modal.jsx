import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';

// Bump the key for a new platinum sponsor so everyone sees the new announcement once.
const SEEN_KEY = 'sponsorModalSeen:remedy-roofing';
const SPONSOR_URL = 'https://remedyroofing.com/';

/**
 * One-time announcement of the platinum sponsor, shown the first time a signed-in
 * user opens the app on this device. Marked as seen as soon as it opens so it never
 * comes back, even if the page is closed without dismissing it.
 */
export function SponsorModal() {
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem(SEEN_KEY);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Storage blocked: the modal may show again next time, which is harmless.
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="sm:max-w-xl">
        <AlertDialogHeader className="items-center text-center sm:text-center">
          <span className="rounded-full bg-[#dde2e8] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#3f4652] dark:bg-[#3a414b] dark:text-[#d5dbe3]">
            Platinum Sponsor
          </span>
          <AlertDialogTitle className="text-xl">{APP_NAME} is proudly sponsored by</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="rounded-xl bg-white px-6 py-8">
          <img src="/sponsors/remedy-roofing.png" alt="Remedy Roofing logo" className="w-full" />
        </div>
        <AlertDialogDescription className="text-center">
          Trusted since 2005, Remedy Roofing handles residential and commercial roofing, gutters, siding, windows and Jellyfish Lighting across the Greater Houston area and Texas.
        </AlertDialogDescription>
        <AlertDialogFooter className="sm:justify-center">
          <Button variant="outline" asChild>
            <a href={SPONSOR_URL} target="_blank" rel="noopener noreferrer">
              Visit remedyroofing.com <ArrowUpRight />
            </a>
          </Button>
          <Button onClick={() => setOpen(false)}>Continue</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
