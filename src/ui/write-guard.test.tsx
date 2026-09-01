// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useWriteGuard, type GuardedAction } from "./write-guard";

afterEach(cleanup);

function Probe({ action, onDone, onAttempt }: { action: GuardedAction; onDone: () => void; onAttempt: () => void }) {
  const guard = useWriteGuard();
  return (
    <div>
      <span data-testid="busy">{guard.busy ?? "idle"}</span>
      <button
        data-testid="fire"
        type="button"
        onClick={() => {
          onAttempt();
          void guard.run(action, async () => {
            await new Promise((r) => setTimeout(r, 20));
            onDone();
          });
        }}
      />
    </div>
  );
}

it("collapses rapid same-tick double activation into one write", async () => {
  const done = vi.fn();
  const attempt = vi.fn();
  const { getByTestId } = render(<Probe action="up" onDone={done} onAttempt={attempt} />);
  const fire = getByTestId("fire");
  // Two activations before the first can complete — click + Enter spam equivalent.
  fireEvent.click(fire);
  fireEvent.click(fire);
  fireEvent.click(fire);
  expect(attempt).toHaveBeenCalledTimes(3); // handler ran 3 times…
  await vi.waitFor(() => expect(done).toHaveBeenCalledOnce()); // …but the write ran once
  await vi.waitFor(() => expect(getByTestId("busy").textContent).toBe("idle"));
});

it("ignores a different action while one is in flight", async () => {
  const done = vi.fn();
  const { getByTestId, rerender } = render(<Probe action="up" onDone={done} onAttempt={() => {}} />);
  fireEvent.click(getByTestId("fire"));
  expect(getByTestId("busy").textContent).toBe("up");
  rerender(<Probe action="claim" onDone={done} onAttempt={() => {}} />);
  fireEvent.click(getByTestId("fire"));
  await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
});

it("releases after a rejection so the next attempt can proceed", async () => {
  let reject: (e: Error) => void = () => {};
  function RejectingProbe() {
    const guard = useWriteGuard();
    return (
      <div>
        <span data-testid="busy">{guard.busy ?? "idle"}</span>
        <button
          data-testid="fire"
          type="button"
          onClick={() =>
            void guard
              .run(
                "faucet",
                () =>
                  new Promise<void>((_, rej) => {
                    reject = rej;
                  }),
              )
              .catch(() => undefined)
          }
        />
      </div>
    );
  }
  const { getByTestId } = render(<RejectingProbe />);
  fireEvent.click(getByTestId("fire"));
  expect(getByTestId("busy").textContent).toBe("faucet");
  await act(async () => {
    reject(new Error("user rejected"));
  });
  await vi.waitFor(() => expect(getByTestId("busy").textContent).toBe("idle"));
  fireEvent.click(getByTestId("fire"));
  expect(getByTestId("busy").textContent).toBe("faucet");
});
