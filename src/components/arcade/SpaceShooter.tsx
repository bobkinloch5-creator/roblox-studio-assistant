import { useRef, useEffect, useState, useCallback } from "react";

type Props = {
  onStart: () => void;
  onGameOver: (score: number) => void;
  running: boolean;
};

// A compact but real arcade space shooter. Arrow keys / A-D to move, space or
// click to shoot. Enemies descend in waves; getting hit ends the run.
export function SpaceShooter({ onStart, onGameOver, running }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(false);
  const stateRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const keysRef = useRef<Record<string, boolean>>({});

  const W = 480;
  const H = 600;

  const endGame = useCallback(
    (finalScore: number) => {
      cancelAnimationFrame(rafRef.current);
      setAlive(false);
      onGameOver(finalScore);
    },
    [onGameOver],
  );

  const start = useCallback(() => {
    onStart();
    setScore(0);
    setAlive(true);
    stateRef.current = {
      player: { x: W / 2, y: H - 50, w: 34, h: 24, cooldown: 0 },
      bullets: [] as { x: number; y: number }[],
      enemies: [] as { x: number; y: number; w: number; h: number; vx: number }[],
      enemyBullets: [] as { x: number; y: number }[],
      spawnTimer: 0,
      tick: 0,
      score: 0,
      stars: Array.from({ length: 60 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        s: Math.random() * 2 + 0.5,
      })),
    };
  }, [onStart]);

  // Kick off a run when the page sets running=true.
  useEffect(() => {
    if (running && !alive) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (["ArrowLeft", "ArrowRight", "a", "d", " ", "A", "D"].includes(e.key)) {
        keysRef.current[e.key.toLowerCase()] = down;
        if (e.key === " ") e.preventDefault();
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  useEffect(() => {
    if (!alive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const loop = () => {
      const s = stateRef.current;
      if (!s) return;
      s.tick++;

      // Player movement.
      const speed = 5;
      if (keysRef.current["arrowleft"] || keysRef.current["a"]) s.player.x -= speed;
      if (keysRef.current["arrowright"] || keysRef.current["d"]) s.player.x += speed;
      s.player.x = Math.max(s.player.w / 2, Math.min(W - s.player.w / 2, s.player.x));

      // Shooting.
      if (s.player.cooldown > 0) s.player.cooldown--;
      if ((keysRef.current[" "] || keysRef.current.fire) && s.player.cooldown === 0) {
        s.bullets.push({ x: s.player.x, y: s.player.y - 16 });
        s.player.cooldown = 10;
      }

      // Spawn enemies in increasing intensity.
      s.spawnTimer--;
      const spawnRate = Math.max(20, 60 - Math.floor(s.score / 200));
      if (s.spawnTimer <= 0) {
        s.spawnTimer = spawnRate;
        const x = 30 + Math.random() * (W - 60);
        s.enemies.push({ x, y: -20, w: 28, h: 22, vx: (Math.random() - 0.5) * 2 });
      }

      // Move bullets.
      s.bullets = s.bullets.filter((b: any) => {
        b.y -= 9;
        return b.y > -10;
      });

      // Move enemies + occasionally fire.
      const enemySpeed = 1.2 + s.score / 1500;
      s.enemies.forEach((e: any) => {
        e.y += enemySpeed;
        e.x += e.vx;
        if (e.x < 20 || e.x > W - 20) e.vx *= -1;
        if (Math.random() < 0.004) s.enemyBullets.push({ x: e.x, y: e.y + 12 });
      });

      // Enemy bullets.
      s.enemyBullets = s.enemyBullets.filter((b: any) => {
        b.y += 5;
        return b.y < H + 10;
      });

      // Bullet vs enemy collisions.
      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const e = s.enemies[i];
        for (let j = s.bullets.length - 1; j >= 0; j--) {
          const b = s.bullets[j];
          if (Math.abs(b.x - e.x) < e.w / 2 && Math.abs(b.y - e.y) < e.h / 2) {
            s.enemies.splice(i, 1);
            s.bullets.splice(j, 1);
            s.score += 25;
            break;
          }
        }
      }

      // Enemy reaches bottom = lose.
      if (s.enemies.some((e: any) => e.y > H - 30)) return endGame(s.score);

      // Enemy bullet hits player.
      const p = s.player;
      if (
        s.enemyBullets.some((b: any) => Math.abs(b.x - p.x) < p.w / 2 && Math.abs(b.y - p.y) < p.h / 2)
      ) {
        return endGame(s.score);
      }

      setScore(s.score);

      // ---- Render ----
      ctx.fillStyle = "#05070d";
      ctx.fillRect(0, 0, W, H);
      // Stars
      ctx.fillStyle = "#2a3550";
      s.stars.forEach((st: any) => {
        st.y += st.s;
        if (st.y > H) st.y = 0;
        ctx.fillRect(st.x, st.y, st.s, st.s);
      });
      // Player ship
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - p.h / 2);
      ctx.lineTo(p.x - p.w / 2, p.y + p.h / 2);
      ctx.lineTo(p.x + p.w / 2, p.y + p.h / 2);
      ctx.closePath();
      ctx.fill();
      // Bullets
      ctx.fillStyle = "#a7f3d0";
      s.bullets.forEach((b: any) => ctx.fillRect(b.x - 2, b.y - 8, 4, 12));
      // Enemies
      ctx.fillStyle = "#f87171";
      s.enemies.forEach((e: any) => {
        ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
      });
      // Enemy bullets
      ctx.fillStyle = "#fca5a5";
      s.enemyBullets.forEach((b: any) => ctx.fillRect(b.x - 2, b.y - 6, 4, 10));

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [alive, endGame]);

  // Touch / pointer controls for mobile: hold and drag to move the ship,
  // auto-fire while a finger is down. Pointer move/up are tracked so the
  // ship follows the finger and fire stops on release.
  const movePointer = (clientX: number) => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    if (!canvas || !s) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    s.player.x = Math.max(s.player.w / 2, Math.min(W - s.player.w / 2, x));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!alive) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    keysRef.current.fire = true;
    movePointer(e.clientX);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!alive) return;
    if (e.buttons === 0 && e.pointerType === "mouse") return; // only drag
    movePointer(e.clientX);
  };
  const handlePointerUp = () => {
    keysRef.current.fire = false;
  };

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm font-mono mb-2">Score: {score}</div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="rounded-lg border border-border bg-[#05070d] max-w-full touch-none select-none"
        style={{ aspectRatio: `${W}/${H}`, width: "100%", maxWidth: W }}
      />
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        Arrow keys or A/D to move · Space to shoot · On mobile, tap to move &amp; fire
      </p>
    </div>
  );
}
