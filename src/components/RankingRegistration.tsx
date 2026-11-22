import { useRef, useState, type FormEvent } from 'react'
import type { GameMode } from '../lib/gameMode'
import { nicknameError, RankingError, submitRanking } from '../lib/ranking'

type Props = {
  mode: GameMode
  correctCount: number
  missCount: number
  maxCombo: number
  online: boolean
  onViewRanking: () => void
}

export function RankingRegistration({ mode, correctCount, missCount, maxCombo, online, onViewRanking }: Props) {
  const [nickname, setNickname] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle')
  const [error, setError] = useState('')
  const submitting = useRef(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || status === 'submitted' || !navigator.onLine) return

    const name = nickname.trim()
    const validationError = nicknameError(name)
    if (validationError) {
      setError(validationError)
      return
    }

    submitting.current = true
    setStatus('submitting')
    setError('')
    try {
      await submitRanking(mode, name, correctCount, missCount, maxCombo)
      setStatus('submitted')
    } catch (failure) {
      setError(failure instanceof RankingError
        ? failure.message
        : '登録できませんでした。接続を確認してお試しください。')
      setStatus('idle')
    } finally {
      submitting.current = false
    }
  }

  return (
    <form className="result-registration" aria-label="ランキングに登録（任意）" onSubmit={onSubmit}>
      {status === 'submitted' ? (
        <div className="result-registration-row">
          <p role="status">登録しました。</p>
          <button type="button" onClick={onViewRanking}>ランキングを見る</button>
        </div>
      ) : (
        <>
          <label htmlFor="ranking-nickname">ランキングに登録（任意）</label>
          <div className="result-registration-row">
            <input
              id="ranking-nickname"
              aria-label="ニックネーム"
              placeholder="ニックネーム（最大10文字）"
              value={nickname}
              disabled={status === 'submitting'}
              onChange={(event) => {
                setNickname(event.target.value)
                setError('')
              }}
            />
            <button type="submit" disabled={!online || status === 'submitting'}>登録</button>
          </div>
          {status === 'submitting' && <p role="status">登録中…</p>}
          {!online && <p role="status">オフラインです。</p>}
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </form>
  )
}
