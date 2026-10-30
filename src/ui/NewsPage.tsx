import type { NewsSource } from '../data/news'
import { NewsFeed } from './NewsFeed'

type Props = { news: NewsSource; now?: () => Date; store?: Storage }

export function NewsPage(props: Props) {
  return (
    <div className="page">
      <NewsFeed {...props} />
    </div>
  )
}
