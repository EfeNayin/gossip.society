export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-black tracking-tighter ${className}`}>
      GOSSIP<span className="text-accent">.</span>SOCIETY
    </span>
  );
}
