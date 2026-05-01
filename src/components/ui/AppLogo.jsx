import './AppLogo.css'

/**
 * AppLogo
 * -------
 * Renders the Docognix logo in two modes:
 *
 *   Default mode  — logo image + optional "Docognix" name + optional tagline
 *                   Used in: sidebar header, landing page hero
 *
 *   avatarOnly    — small rounded square avatar (no text)
 *                   Used in: AI chat message bubble
 *
 * Props:
 *   size       'sm' | 'md' | 'lg' | 'xl'
 *   showName   boolean   show "Docognix" text
 *   showTag    boolean   show "Intelligence over documents"
 *   avatarOnly boolean   render only the avatar box (no text)
 *   className  string
 */
export function AppLogo({ size = 'md', showName = true, showTag = false, avatarOnly = false, className = '' }) {
  if (avatarOnly) {
    return (
      <div className={`app-logo-avatar app-logo-avatar--${size} ${className}`.trim()}>
        <img src="/logo.png" alt="Docognix" className="app-logo-avatar__img" draggable={false} />
      </div>
    )
  }

  return (
    <div className={`app-logo app-logo--${size} ${className}`.trim()}>
      <img src="/logo.png" alt="Docognix logo" className="app-logo__img" draggable={false} />

      {(showName || showTag) && (
        <div className="app-logo__text-wrap">
          {showName && (
            <span className="app-logo__name">
              <span className="app-logo__docog">Docog</span>
              <span className="app-logo__nix">nix</span>
            </span>
          )}
          {showTag && (
            <span className="app-logo__tag">Intelligence over documents</span>
          )}
        </div>
      )}
    </div>
  )
}
