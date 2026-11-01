import { NewsFeed, type NewsFeedProps } from './NewsFeed'

export function NewsPage(props: Omit<NewsFeedProps, 'limit' | 'title' | 'layout'>) {
  return (
    <div className="page">
      <NewsFeed {...props} layout="cards" />
    </div>
  )
}
