import re

with open('frontend/src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the messy section
# We'll just replace the whole visualizer end and dashboard start
start_marker = '<span className=\"text-xs font-bold uppercase\">Retrieve</span>'
end_marker = 'Continue Last Conversation'

match = re.search(f'{start_marker}.*?{end_marker}', content, re.DOTALL)
if match:
    replacement = '''<span className="text-xs font-bold uppercase">Retrieve</span>
        </div>

        <div className={cn("flex flex-col items-center gap-2 transition-all duration-300", getNodeClasses(3), step === 4 && "animate-shake") + " rounded-xl p-3 border-2"}>
          <ShieldAlert className="w-6 h-6" />
          <span className="text-xs font-bold uppercase">Evaluate</span>
        </div>

        <div className={cn("flex flex-col items-center gap-2 transition-all duration-300", getNodeClasses(5)) + " rounded-xl p-3 border-2"}>
          <Bot className="w-6 h-6" />
          <span className="text-xs font-bold uppercase">Generate</span>
        </div>
      </div>
    </motion.div>
  )
}

function PersonalizedDashboard() {
  const { user, isLoading: isUserLoading } = useUser()
  const prefersReducedMotion = useReducedMotion()
  const [docs, setDocs] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [docsRes, histRes] = await Promise.all([
          fetch("/api/v1/documents").catch(() => null),
          fetch("/api/v1/history").catch(() => null)
        ])
        
        if (docsRes?.ok) {
          const docsData = await docsRes.json()
          setDocs(docsData.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
        }
        
        if (histRes?.ok) {
          const histData = await histRes.json()
          setSessions(histData)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  if (isUserLoading) {
    return (
      <div className="flex w-full min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }
  
  if (!user) return null

  const recentDocs = docs.slice(0, 3)
  const recentSessions = sessions.slice(0, 3)
  const lastSession = sessions.length > 0 ? sessions[0] : null


  return (
    <div className="w-full max-w-5xl mt-8 space-y-12 text-left">
      {/* Continue Last Conversation Banner */}
      {lastSession && (
        <motion.section variants={itemVariants}>
          <motion.div whileHover={prefersReducedMotion ? {} : { y: -4, scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
            <Card className="bg-primary/5 backdrop-blur-xl border-primary/20 shadow-[0_8px_30px_rgba(var(--primary),0.1)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-all duration-700 group-hover:bg-primary/20" />
              <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    Continue Last Conversation'''
    
    content = content[:match.start()] + replacement + content[match.end():]
    
    with open('frontend/src/app/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed!")
else:
    print("Could not find markers")
