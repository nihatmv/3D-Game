import { useStoryStore } from '../../store/useStoryStore'
import { CONTACT, PROJECTS } from '../../story/projects'
import { QUESTS } from '../../story/quests'
import { ContactLinks } from './ProjectCard'
import { ProjectLinks, StackChips } from './ProjectBody'

/** Which projects already have a landmark on the island. */
function useBuiltProjects() {
  const built = useStoryStore((s) => s.built)
  return new Set(QUESTS.filter((q) => built.includes(q.id)).map((q) => q.projectId))
}

/**
 * The plain list view: every project and the contact info, readable whether
 * or not the visitor played. Nothing here is gated by quest progress.
 */
export function PortfolioPanel() {
  const open = useStoryStore((s) => s.portfolioOpen)
  const setOpen = useStoryStore((s) => s.setPortfolioOpen)
  const openProject = useStoryStore((s) => s.openProject)
  const builtProjects = useBuiltProjects()
  if (!open) return null

  return (
    <aside className="pf-panel" aria-label="Portfolio">
      <header className="pf-panel-head">
        <div>
          <div className="pf-eyebrow">Portfolio</div>
          <h2>{CONTACT.name}</h2>
          <p className="pf-pitch">{CONTACT.role}</p>
        </div>
        <button className="pf-close" onClick={() => setOpen(false)} aria-label="Close portfolio">
          ✕
        </button>
      </header>

      <ul className="pf-list">
        {PROJECTS.map((p) => (
          <li key={p.id} className="pf-item">
            <button className="pf-item-title" onClick={() => openProject(p.id)}>
              <span>{p.title}</span>
              {builtProjects.has(p.id) ? (
                <span className="pf-badge built">on the island</span>
              ) : (
                <span className="pf-badge">not built yet</span>
              )}
            </button>
            <p className="pf-pitch">{p.pitch}</p>
            <StackChips stack={p.stack} />
            <ProjectLinks project={p} />
          </li>
        ))}
      </ul>

      <section className="pf-contact">
        <div className="pf-eyebrow">Get in touch</div>
        <p className="pf-details">{CONTACT.blurb}</p>
        <p className="pf-edu">🎓 {CONTACT.education}</p>
        <ContactLinks />
      </section>
    </aside>
  )
}
