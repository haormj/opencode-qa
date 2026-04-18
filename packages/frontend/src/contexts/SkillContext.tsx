import { createContext, useContext, useEffect, useState } from 'react'
import { getSkills, type Skill } from '../services/api'

interface SkillContextType {
  skills: Skill[]
  loading: boolean
}

const SkillContext = createContext<SkillContextType>({ skills: [], loading: true })

export function SkillProvider({ children }: { children: React.ReactNode }) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSkills({ pageSize: 1000 })
      .then(res => setSkills(res.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <SkillContext.Provider value={{ skills, loading }}>
      {children}
    </SkillContext.Provider>
  )
}

export function useSkills() {
  return useContext(SkillContext)
}
