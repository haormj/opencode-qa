import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getPublicSettings } from '../services/api'

export function usePageTitle() {
  const location = useLocation()
  const [siteTitle, setSiteTitle] = useState('OpenCode QA')
  const [adminTitle, setAdminTitle] = useState('OpenCode QA Admin')

  useEffect(() => {
    getPublicSettings().then(settings => {
      if (settings['site.title']) {
        setSiteTitle(settings['site.title'])
      }
      if (settings['site.adminTitle']) {
        setAdminTitle(settings['site.adminTitle'])
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const isAdminRoute = location.pathname.startsWith('/admin')
    document.title = isAdminRoute ? adminTitle : siteTitle
  }, [location.pathname, siteTitle, adminTitle])
}
