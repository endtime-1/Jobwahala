import { useParams } from 'react-router-dom'
import { skillFromCoursesSlug } from '../lib/courses'
import CourseLanding from './CourseLanding'
import SearchLanding from './SearchLanding'

/** One-segment addresses: "[skill] courses in Ghana", otherwise a jobs landing page ("jobs-in-accra", "banking-jobs"). */
export default function SlugPage() {
  const { slug = '' } = useParams()
  const skill = skillFromCoursesSlug(slug)

  return skill ? <CourseLanding kind="skill" slug={skill} /> : <SearchLanding />
}

/** /courses/category/:category */
export function CourseCategoryPage() {
  const { category = '' } = useParams()
  return <CourseLanding kind="category" slug={category} />
}
