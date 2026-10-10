import { isTourActive, useStoryStore } from '../../store/useStoryStore'
import { projectById } from '../../story/projects'
import { TOUR } from '../../story/quests'
import { stepBy } from '../../story/scroll'
import { PirateAvatar } from './PirateAvatar'
import { ProjectLinks, ProjectMedia, ProjectResult } from './ProjectBody'

/**
 * The compact card that comes with the scroll once a stop's landmark stands:
 * the captain's line, a picture, the project's name, pitch and one result, and
 * its links. Details opens the full card (ProjectCard); scrolling on (or the
 * hint, which is a button) plays the story to the next stop.
 */
export function StopCard() {
  const quest = useStoryStore((s) => (isTourActive(s) && s.beat.part === 'card' && !s.openCard ? TOUR[s.beat.stop] : undefined))
  const openProject = useStoryStore((s) => s.openProject)
  const project = quest?.projectId ? projectById(quest.projectId) : undefined
  if (!quest || !project) return null
  // One picture, whichever the project has.
  const cover = project.media ?? project.gallery?.[0] ?? project.shipped?.find((s) => s.image)?.image

  return (
    <aside className="pf-card stop-card" key={project.id} aria-label={project.title}>
      <div className="pf-captain">
        <span className="pf-captain-avatar" aria-hidden>
          <PirateAvatar />
        </span>
        <p>{quest.doneLine}</p>
      </div>
      <ProjectMedia project={{ ...project, media: cover }} />
      {project.tag && <div className="pf-eyebrow">{project.tag}</div>}
      <h2>{project.title}</h2>
      <p className="pf-pitch">{project.pitch}</p>
      <ProjectResult project={project} />
      <ProjectLinks project={project} />
      <div className="pf-card-foot">
        <button className="stop-next" onClick={() => stepBy(1)}>
          Keep scrolling ↓
        </button>
        <button className="pf-continue" onClick={() => openProject(project.id)}>
          Details
        </button>
      </div>
    </aside>
  )
}
