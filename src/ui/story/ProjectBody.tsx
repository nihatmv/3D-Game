import { track } from '../../analytics'
import { CONTACT, type Project } from '../../story/projects'

const contactClick = (channel: string) => () => track('contact_clicked', { channel })

const isVideo = (src: string) => /\.(mp4|webm)$/i.test(src)

/** Screenshot, GIF or muted looping video, or a soft placeholder tile with the project's initials. */
export function ProjectMedia({ project }: { project: Project }) {
  const { media } = project
  if (media && isVideo(media))
    return <video className="pf-media" src={media} autoPlay muted loop playsInline aria-label={`${project.title} demo`} />
  if (media) return <img className="pf-media" src={media} alt={`${project.title} screenshot`} loading="lazy" />
  const initials = project.title
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <div className="pf-media pf-media-empty" aria-hidden>
      {initials}
    </div>
  )
}

/** The one number a visitor should remember. */
export function ProjectResult({ project }: { project: Project }) {
  if (!project.result) return null
  return <p className="pf-result">{project.result}</p>
}

/** Small "Download CV" link, shown on every card. */
export function CvLink() {
  if (!CONTACT.cv) return null
  return (
    <a className="pf-cv" href={CONTACT.cv} target="_blank" rel="noreferrer" download onClick={contactClick('cv')}>
      ⬇ Download CV
    </a>
  )
}

export function StackChips({ stack }: { stack: string[] }) {
  return (
    <ul className="pf-chips" aria-label="Tech stack">
      {stack.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ul>
  )
}

export function ProjectLinks({ project }: { project: Project }) {
  const { github, live } = project.links
  if (!github && !live) return null
  return (
    <div className="pf-links">
      {live && (
        <a className="pf-link primary" href={live} target="_blank" rel="noreferrer">
          Live demo ↗
        </a>
      )}
      {github && (
        <a className="pf-link" href={github} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      )}
    </div>
  )
}

/** Photo from CONTACT.photo, or a circle with initials until there is one. */
export function Portrait({ className }: { className: string }) {
  if (CONTACT.photo) return <img className={className} src={CONTACT.photo} alt={CONTACT.name} />
  const initials = CONTACT.name
    .replace(/^TODO\s*/, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <div className={`${className} pf-photo-empty`} aria-hidden>
      {initials}
    </div>
  )
}

export function ContactLinks() {
  const { email, linkedin, github, cv } = CONTACT
  return (
    <div className="pf-links">
      {email && (
        <a className="pf-link primary" href={`mailto:${email}`} onClick={contactClick('email')}>
          Email me
        </a>
      )}
      {linkedin && (
        <a className="pf-link" href={linkedin} target="_blank" rel="noreferrer" onClick={contactClick('linkedin')}>
          LinkedIn ↗
        </a>
      )}
      {github && (
        <a className="pf-link" href={github} target="_blank" rel="noreferrer" onClick={contactClick('github')}>
          GitHub ↗
        </a>
      )}
      {cv && (
        <a className="pf-link" href={cv} target="_blank" rel="noreferrer" download onClick={contactClick('cv')}>
          Download CV ⬇
        </a>
      )}
    </div>
  )
}
