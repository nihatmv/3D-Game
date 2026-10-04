import { useStoryStore } from '../../store/useStoryStore'
import { CONTACT, EDUCATION, projectById } from '../../story/projects'
import { QUESTS } from '../../story/quests'
import { PirateAvatar } from './PirateAvatar'
import { ContactLinks, CvLink, Portrait, ProjectGallery, ProjectLinks, ProjectMedia, ProjectResult, ShippedList, StackChips } from './ProjectBody'
import { ProjectDemo } from './ProjectDemo'

/**
 * The card for one project (or the contact card), in the middle of the screen
 * beside its landmark (CameraRig frames the landmark to the left). In the tour
 * it carries the captain's line and a Continue button that flies the camera
 * home and shows the next task.
 */
export function ProjectCard() {
  const openCard = useStoryStore((s) => s.openCard)
  const lastDone = useStoryStore((s) => s.lastDone)
  const phase = useStoryStore((s) => s.phase)
  const closeCard = useStoryStore((s) => s.closeCard)
  const autoBuild = useStoryStore((s) => s.autoBuild)
  if (!openCard) return null

  if (openCard === 'contact') {
    return (
      <aside className="pf-card pf-contact-card" key="contact" aria-label="Contact">
        <button className="pf-close" onClick={closeCard} aria-label="Close">
          ✕
        </button>
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
      </aside>
    )
  }

  const project = projectById(openCard)
  if (!project) return null
  // The card the tour just raised (not one reopened from the island or the list).
  const done = lastDone ? QUESTS.find((q) => q.id === lastDone && q.projectId === openCard) : undefined
  // In "Build it all" the tour director closes tour cards itself, so the
  // visitor gets no Continue or ✕ to press.
  const manual = !(done && autoBuild)
  const continueLabel = !done ? 'Close' : phase === 'questing' ? 'Continue →' : 'Finish the tour →'

  return (
    <aside className="pf-card" key={project.id} aria-label={project.title}>
      {manual && (
        <button className="pf-close" onClick={closeCard} aria-label="Close">
          ✕
        </button>
      )}
      {done && (
        <div className="pf-captain">
          <span className="pf-captain-avatar" aria-hidden>
            <PirateAvatar />
          </span>
          <p>{done.doneLine}</p>
        </div>
      )}
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
        {manual ? (
          <button className="pf-continue" onClick={closeCard} autoFocus>
            {continueLabel}
          </button>
        ) : (
          <span className="pf-auto-next">⚡ Building on…</span>
        )}
      </div>
    </aside>
  )
}
