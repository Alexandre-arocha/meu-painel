import { NewsFeed, type NewsFeedProps } from './NewsFeed'

export function NewsPage(props: Omit<NewsFeedProps, 'limit' | 'title'>) {
  return (
    <div className="page">
      <NewsFeed {...props} />
    </div>
  )
}
