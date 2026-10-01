import { useStoryStore } from '../../store/useStoryStore'
import { CONTACT, projectById } from '../../story/projects'
import { ProjectLinks, ProjectMedia, StackChips } from './ProjectBody'

/** Slide-in card for one project (or the contact card). */
export function ProjectCard() {
  const openCard = useStoryStore((s) => s.openCard)
  const closeCard = useStoryStore((s) => s.closeCard)
  if (!openCard) return null

  if (openCard === 'contact') {
    return (
      <aside className="pf-card" key="contact" aria-label="Contact">
        <button className="pf-close" onClick={closeCard} aria-label="Close">
          ✕
        </button>
        <div className="pf-eyebrow">The ship has docked</div>
        <h2>{CONTACT.name}</h2>
        <p className="pf-pitch">{CONTACT.role}</p>
        <p className="pf-details">{CONTACT.blurb}</p>
        <p className="pf-edu">🎓 {CONTACT.education}</p>
        <ContactLinks />
      </aside>
    )
  }

  const project = projectById(openCard)
  if (!project) return null
  return (
    <aside className="pf-card" key={project.id} aria-label={project.title}>
      <button className="pf-close" onClick={closeCard} aria-label="Close">
        ✕
      </button>
      <ProjectMedia project={project} />
      {project.tag && <div className="pf-eyebrow">{project.tag}</div>}
      <h2>{project.title}</h2>
      <p className="pf-pitch">{project.pitch}</p>
      {project.details && <p className="pf-details">{project.details}</p>}
      <StackChips stack={project.stack} />
      <ProjectLinks project={project} />
    </aside>
  )
}

export function ContactLinks() {
  const { email, linkedin, github, cv } = CONTACT
  return (
    <div className="pf-links">
      {email && (
        <a className="pf-link primary" href={`mailto:${email}`}>
          Email me
        </a>
      )}
      {linkedin && (
        <a className="pf-link" href={linkedin} target="_blank" rel="noreferrer">
          LinkedIn ↗
        </a>
      )}
      {github && (
        <a className="pf-link" href={github} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      )}
      {cv && (
        <a className="pf-link" href={cv} target="_blank" rel="noreferrer">
          CV ↗
        </a>
      )}
    </div>
  )
}
