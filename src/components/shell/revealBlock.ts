/** 側欄點題目時，請卷面捲到那一題。卷面上直接點的不會觸發，避免畫面跳動。 */
type Listener = (id: string) => void

const listeners = new Set<Listener>()

export function requestReveal(id: string): void {
  for (const listener of listeners) listener(id)
}

export function onRevealRequest(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
