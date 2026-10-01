import type { Project } from '../../story/projects'

/** Screenshot/GIF, or a soft placeholder tile with the project's initials. */
export function ProjectMedia({ project }: { project: Project }) {
  if (project.media) return <img className="pf-media" src={project.media} alt={`${project.title} screenshot`} loading="lazy" />
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
