import { useEffect } from 'react'
import { hideBoot } from '../boot'
import { ISLAND_HREF } from '../routes'
import { VISITOR, withVisitor } from '../visitor'
import { CONTACT, EDUCATION, EXPERIENCE, PROJECTS, type Project } from '../story/projects'
import { ContactLinks, Portrait, ProjectLinks, ProjectMedia, ProjectResult, StackChips } from '../ui/story/ProjectBody'
import { ProjectDemo } from '../ui/story/ProjectDemo'
import '../ui/story/Story.css'
import './PortfolioPage.css'

/**
 * The plain, fast portfolio: no 3D, everything on one scrolling page, read
 * from projects.ts like the island's cards. This is where "Skip" goes, and
 * what phones see first.
 */
export function PortfolioPage() {
  useEffect(hideBoot, [])
  return (
    <div className="pp">
      <main className="pp-inner">
        {VISITOR && <p className="pp-greeting">👋 Hi, {VISITOR} team. Thanks for stopping by!</p>}
        <header className="pp-hero">
          <Portrait className="pp-photo" />
          <div className="pp-hero-text">
            <h1>{CONTACT.name}</h1>
            <p className="pp-role">{CONTACT.role}</p>
            <p className="pp-pitch">{CONTACT.pitch}</p>
            <ContactLinks />
          </div>
        </header>

        <a className="pp-island" href={withVisitor(ISLAND_HREF)}>
          <span aria-hidden>🏝️</span>
          <span>
            <b>Explore the island</b>
            <small>The same projects as a one-minute interactive tour</small>
          </span>
          <span aria-hidden>→</span>
        </a>

        <section aria-labelledby="pp-projects">
          <h2 id="pp-projects">Projects</h2>
          <div className="pp-grid">
            {PROJECTS.map((p) => (
              <ProjectTile key={p.id} project={p} />
            ))}
          </div>
        </section>

        {EXPERIENCE.length > 0 && (
          <section aria-labelledby="pp-exp">
            <h2 id="pp-exp">Experience</h2>
            <ol className="pp-timeline">
              {EXPERIENCE.map((e) => (
                <li key={`${e.org}-${e.role}`}>
                  <div className="pp-when">{e.when}</div>
                  <div>
                    <h3>
                      {e.role} <span>· {e.org}</span>
                    </h3>
                    <p>{e.summary}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {EDUCATION.length > 0 && (
          <section aria-labelledby="pp-edu">
            <h2 id="pp-edu">Education</h2>
            <ol className="pp-timeline">
              {EDUCATION.map((e) => (
                <li key={`${e.school}-${e.degree}`}>
                  <div className="pp-when">{e.when}</div>
                  <div>
                    <h3>
                      {e.degree} <span>· {e.school}</span>
                    </h3>
                    {e.note && <p>{e.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="pp-contact" aria-labelledby="pp-contact">
          <h2 id="pp-contact">Get in touch</h2>
          <p>{CONTACT.blurb}</p>
          <ContactLinks />
        </footer>
      </main>
    </div>
  )
}

function ProjectTile({ project }: { project: Project }) {
  return (
    <article className="pp-card">
      <ProjectMedia project={project} />
      {project.tag && <div className="pf-eyebrow">{project.tag}</div>}
      <h3>{project.title}</h3>
      <p className="pf-pitch">{project.pitch}</p>
      <ProjectResult project={project} />
      {project.details && <p className="pf-details">{project.details}</p>}
      <ProjectDemo demo={project.demo} />
      <StackChips stack={project.stack} />
      <ProjectLinks project={project} />
    </article>
  )
}
