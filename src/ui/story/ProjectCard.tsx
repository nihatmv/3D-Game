import { isTourActive, useStoryStore } from '../../store/useStoryStore'
import { CONTACT, EDUCATION, projectById } from '../../story/projects'
import { ContactLinks, CvLink, Portrait, ProjectGallery, ProjectLinks, ProjectMedia, ProjectResult, ShippedList, StackChips } from './ProjectBody'
import { ProjectDemo } from './ProjectDemo'

/**
 * The full card for one project (or the contact card), in the middle of the
 * screen beside its landmark (CameraRig frames the landmark to the left).
 * Opened from a stop's compact card (Details) or by clicking a landmark in
 * free play. The contact card also comes up by itself at the end of the scroll,
 * with the way into free play.
 */
export function ProjectCard() {
  const openCard = useStoryStore((s) => s.openCard)
  const closeCard = useStoryStore((s) => s.closeCard)
  const explore = useStoryStore((s) => s.explore)
  // The end of the tour: the scroll brings the contact card up, and scrolling back takes it away.
  const ended = useStoryStore((s) => isTourActive(s) && s.beat.part === 'contact' && !s.openCard)
  if (!openCard && !ended) return null

  if (openCard === 'contact' || ended) {
    return (
      <aside className="pf-card pf-contact-card" key="contact" aria-label="Contact">
        {!ended && (
          <button className="pf-close" onClick={closeCard} aria-label="Close">
            ✕
          </button>
        )}
        <Portrait className="pf-photo" />
        <div className="pf-eyebrow">The ship has docked</div>
        <h2>{CONTACT.name}</h2>
        <p className="pf-pitch">{CONTACT.role}</p>
        <p className="pf-details">{CONTACT.blurb}</p>
        {EDUCATION[0] && (
          <p className="pf-edu">
            🎓 {EDUCATION[0].degree}, {EDUCATION[0].school}
          </p>
        )}
        <ContactLinks />
        {ended && (
          <div className="pf-card-foot">
            <span className="stop-next">Or stay a while</span>
            <button className="pf-continue" onClick={explore}>
              Explore the island
            </button>
          </div>
        )}
      </aside>
    )
  }

  const project = openCard ? projectById(openCard) : undefined
  if (!project) return null
  return (
    <aside className="pf-card" key={project.id} aria-label={project.title}>
      <button className="pf-close" onClick={closeCard} aria-label="Close">
        ✕
      </button>
      {project.shipped?.length ? (
        <ShippedList project={project} />
      ) : project.gallery?.length ? (
        <ProjectGallery project={project} />
      ) : (
        <ProjectMedia project={project} />
      )}
      {project.tag && <div className="pf-eyebrow">{project.tag}</div>}
      <h2>{project.title}</h2>
      <p className="pf-pitch">{project.pitch}</p>
      <ProjectResult project={project} />
      <ProjectDemo demo={project.demo} />
      <StackChips stack={project.stack} />
      <ProjectLinks project={project} />
      <div className="pf-card-foot">
        <CvLink />
        <button className="pf-continue" onClick={closeCard} autoFocus>
          Close
        </button>
      </div>
    </aside>
  )
}
