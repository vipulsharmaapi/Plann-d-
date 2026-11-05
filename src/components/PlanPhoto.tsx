import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { photoUrl, safeExternalUrl, type VenueDetails } from '../lib/venues'

export default function PlanPhoto({
  place,
  name,
  loading = false,
}: {
  place: VenueDetails | null
  name: string
  loading?: boolean
}) {
  const photo = place?.photos?.[0]
  const url = photo ? photoUrl(photo) : null
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <figure className="plan-photo">
      {url && failed !== url ? (
        <>
          <img src={url} alt={name} loading="lazy" onError={() => setFailed(url)} />
          <figcaption>
            Google Maps ·{' '}
            {photo?.authorAttributions?.length
              ? photo.authorAttributions.map((author, index) => (
                  <span key={index}>
                    {index > 0 ? ', ' : ''}
                    {safeExternalUrl(author.uri) ? (
                      <a
                        href={safeExternalUrl(author.uri)!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {author.displayName}
                      </a>
                    ) : (
                      author.displayName
                    )}
                  </span>
                ))
              : 'Contributors'}
            {place?.attributions?.map((item, index) => (
              <span key={index}>
                {' '}
                ·{' '}
                {safeExternalUrl(item.providerUri) ? (
                  <a
                    href={safeExternalUrl(item.providerUri)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.provider}
                  </a>
                ) : (
                  item.provider
                )}
              </span>
            ))}
          </figcaption>
        </>
      ) : (
        <div className="plan-photo-empty">
          <MapPin size={28} aria-hidden="true" />
          <span>{loading ? 'Loading photo…' : 'Venue photo unavailable'}</span>
        </div>
      )}
    </figure>
  )
}
