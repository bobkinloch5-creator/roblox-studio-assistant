import { useRef, useEffect, useState, useCallback } from "react";

type Props = {
  onStart: () => void;
  onGameOver: (score: number) => void;
  running: boolean;
};

export function BrickBreaker({ onStart, onGameOver, running }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(false);
  const stateRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const keysRef = useRef<Record<string, boolean>>({});

  const W = 480;
  const H = 600;
  const COLS = 8;
  const ROWS = 5;

  const endGame = useCallback(
    (finalScore: number) => {
      cancelAnimationFrame(rafRef.current);
      setAlive(false);
      onGameOver(finalScore);
    },
    [onGameOver],
  );

  const buildBricks = useCallback(() => {
    const pad = 6;
    const bw = (W - pad * (COLS + 1)) / COLS;
    const bh = 22;
    const bricks: any[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        bricks.push({
          x: pad + c * (bw + pad),
          y: 60 + r * (bh + pad),
          w: bw,
          h: bh,
          alive: true,
          hue: 150 + r * 14,
        });
      }
    }
    return bricks;
  }, []);

  const start = useCallback(() => {
    onStart();
    setScore(0);
    setAlive(true);
    stateRef.current = {
      paddle: { x: W / 2, w: 90, h: 12 },
      ball: { x: W / 2, y: H - 80, vx: 3.5, vy: -3.5, r: 7 },
      bricks: buildBricks(),
      lives: 3,
      score: 0,
      level: 1,
    };
  }, [onStart, buildBricks]);

  useEffect(() => {
    if (running && !alive) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key)) {
        keysRef.current[e.key.toLowerCase()] = down;
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

      // Paddle.
      const speed = 7;
      if (keysRef.current["arrowleft"] || keysRef.current["a"]) s.paddle.x -= speed;
      if (keysRef.current["arrowright"] || keysRef.current["d"]) s.paddle.x += speed;
      s.paddle.x = Math.max(s.paddle.w / 2, Math.min(W - s.paddle.w / 2, s.paddle.x));

      // Ball.
      const b = s.ball;
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < b.r || b.x > W - b.r) b.vx *= -1;
      if (b.y < b.r) b.vy *= -1;

      // Paddle collision.
      const py = H - 30;
      if (
        b.y + b.r >= py &&
        b.y + b.r <= py + s.paddle.h + 8 &&
        b.x >= s.paddle.x - s.paddle.w / 2 &&
        b.x <= s.paddle.x + s.paddle.w / 2 &&
        b.vy > 0
      ) {
        b.vy *= -1;
        // Add english based on where it hit the paddle.
        const offset = (b.x - s.paddle.x) / (s.paddle.w / 2);
        b.vx = offset * 5;
      }

      // Lost ball.
      if (b.y > H + 20) {
        s.lives--;
        if (s.lives <= 0) return endGame(s.score);
        b.x = W / 2;
        b.y = H - 80;
        b.vx = 3.5;
        b.vy = -3.5;
      }

      // Brick collisions.
      for (const br of s.bricks) {
        if (!br.alive) continue;
        if (b.x > br.x && b.x < br.x + br.w && b.y - b.r < br.y + br.h && b.y + b.r > br.y) {
          br.alive = false;
          b.vy *= -1;
          s.score += 10;
          break;
        }
      }

      // Cleared the board → new tougher level.
      if (s.bricks.every((br: any) => !br.alive)) {
        s.level++;
        s.bricks = buildBricks();
        b.x = W / 2;
        b.y = H - 80;
        const sp = 3.5 + s.level * 0.5;
        b.vx = sp;
        b.vy = -sp;
        s.score += 50;
      }

      setScore(s.score);

      // ---- Render ----
      ctx.fillStyle = "#05070d";
      ctx.fillRect(0, 0, W, H);
      // Bricks
      for (const br of s.bricks) {
        if (!br.alive) continue;
        ctx.fillStyle = `hsl(${br.hue} 65% 55%)`;
        ctx.fillRect(br.x, br.y, br.w, br.h);
      }
      // Paddle
      ctx.fillStyle = "#34d399";
      ctx.fillRect(s.paddle.x - s.paddle.w / 2, py, s.paddle.w, s.paddle.h);
      // Ball
      ctx.fillStyle = "#a7f3d0";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      // HUD
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px monospace";
      ctx.fillText(`Lives: ${s.lives}   Level: ${s.level}`, 8, 20);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [alive, endGame, buildBricks]);

  const movePaddle = (clientX: number) => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    if (!canvas || !s) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    s.paddle.x = Math.max(s.paddle.w / 2, Math.min(W - s.paddle.w / 2, x));
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!alive) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    movePaddle(e.clientX);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!alive) return;
    // Mouse: only while button held. Touch/pen: always follow.
    if (e.pointerType === "mouse" && e.buttons === 0) return;
    movePaddle(e.clientX);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm font-mono mb-2">Score: {score}</div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={onDown}
        onPointerMove={onMove}
        className="rounded-lg border border-border bg-[#05070d] max-w-full touch-none select-none"
        style={{ aspectRatio: `${W}/${H}`, width: "100%", maxWidth: W }}
      />
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        Arrow keys or A/D to move · On mobile, drag to move the paddle
      </p>
    </div>
  );
}
