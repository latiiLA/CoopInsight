export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t px-4 py-3 text-center text-xs text-muted-foreground">
      &copy; {year} All Rights Reserved | Designed, Built and Maintained by{" "}
      <a
        href="https://latiila.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline underline-offset-2 hover:text-foreground"
      >
        Lata Amenu
      </a>
    </footer>
  );
}
