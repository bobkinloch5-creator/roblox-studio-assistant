import { useRef, useEffect, useState, useCallback } from "react";

type Props = {
  onStart: () => void;
  onGameOver: (score: number) => void;
  running: boolean;
};

export function Snake({ onStart, onGameOver, running }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(false);
  const stateRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const lastStepRef = useRef<number>(0);
  const dirRef = useRef<{ x: number; y: number }>({ x: 1, y: 0 });
  const nextDirRef = useRef<{ x: number; y: number }>({ x: 1, y: 0 });
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const SIZE = 480;
  const CELLS = 20;
  const CELL = SIZE / CELLS;

  const endGame = useCallback(
    (finalScore: number) => {
      cancelAnimationFrame(rafRef.current);
      setAlive(false);
      onGameOver(finalScore);
    },
    [onGameOver],
  );

  const randFood = (snake: any[]) => {
    let f: any;
    do {
      f = { x: Math.floor(Math.random() * CELLS), y: Math.floor(Math.random() * CELLS) };
    } while (snake.some((s) => s.x === f.x && s.y === f.y));
    return f;
  };

  const start = useCallback(() => {
    onStart();
    setScore(0);
    setAlive(true);
    dirRef.current = { x: 1, y: 0 };
    nextDirRef.current = { x: 1, y: 0 };
    const snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    stateRef.current = { snake, food: randFood(snake), score: 0, stepMs: 140 };
    lastStepRef.current = 0;
  }, [onStart]);

  useEffect(() => {
    if (running && !alive) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = dirRef.current;
      if ((e.key === "ArrowUp" || e.key === "w") && d.y === 0) nextDirRef.current = { x: 0, y: -1 };
      else if ((e.key === "ArrowDown" || e.key === "s") && d.y === 0) nextDirRef.current = { x: 0, y: 1 };
      else if ((e.key === "ArrowLeft" || e.key === "a") && d.x === 0) nextDirRef.current = { x: -1, y: 0 };
      else if ((e.key === "ArrowRight" || e.key === "d") && d.x === 0) nextDirRef.current = { x: 1, y: 0 };
      if (e.key.startsWith("Arrow")) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!alive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const loop = (ts: number) => {
      const s = stateRef.current;
      if (!s) return;

      if (ts - lastStepRef.current >= s.stepMs) {
        lastStepRef.current = ts;
        dirRef.current = nextDirRef.current;
        const head = {
          x: s.snake[0].x + dirRef.current.x,
          y: s.snake[0].y + dirRef.current.y,
        };
        // Wall / self collision.
        if (
          head.x < 0 ||
          head.x >= CELLS ||
          head.y < 0 ||
          head.y >= CELLS ||
          s.snake.some((seg: any) => seg.x === head.x && seg.y === head.y)
        ) {
          return endGame(s.score);
        }
        s.snake.unshift(head);
        if (head.x === s.food.x && head.y === s.food.y) {
          s.score += 10;
          s.food = randFood(s.snake);
          s.stepMs = Math.max(70, s.stepMs - 3); // speed up
          setScore(s.score);
        } else {
          s.snake.pop();
        }
      }

      // ---- Render ----
      ctx.fillStyle = "#05070d";
      ctx.fillRect(0, 0, SIZE, SIZE);
      // grid dots
      ctx.fillStyle = "#11182a";
      for (let i = 0; i < CELLS; i++) {
        for (let j = 0; j < CELLS; j++) {
          ctx.fillRect(i * CELL + CELL / 2 - 1, j * CELL + CELL / 2 - 1, 2, 2);
        }
      }
      // food
      ctx.fillStyle = "#f87171";
      ctx.fillRect(s.food.x * CELL + 3, s.food.y * CELL + 3, CELL - 6, CELL - 6);
      // snake
      s.snake.forEach((seg: any, i: number) => {
        ctx.fillStyle = i === 0 ? "#34d399" : "#10b981";
        ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [alive, endGame]);

  // Swipe controls.
  const onTouchStart = (e: React.PointerEvent) => {
    touchRef.current = { x: e.clientX, y: e.clientY };
  };
  const onTouchEnd = (e: React.PointerEvent) => {
    const t = touchRef.current;
    if (!t) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    const d = dirRef.current;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 20 && d.x === 0) nextDirRef.current = { x: 1, y: 0 };
      else if (dx < -20 && d.x === 0) nextDirRef.current = { x: -1, y: 0 };
    } else {
      if (dy > 20 && d.y === 0) nextDirRef.current = { x: 0, y: 1 };
      else if (dy < -20 && d.y === 0) nextDirRef.current = { x: 0, y: -1 };
    }
    touchRef.current = null;
  };

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm font-mono mb-2">Score: {score}</div>
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        onPointerDown={onTouchStart}
        onPointerUp={onTouchEnd}
        className="rounded-lg border border-border bg-[#05070d] max-w-full touch-none"
        style={{ aspectRatio: "1/1", width: "100%", maxWidth: SIZE }}
      />
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        Arrow keys or WASD · On mobile, swipe to turn
      </p>
    </div>
  );
}
