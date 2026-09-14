import React, { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Progress } from "@/components/ui/progress"
import { GradesItem, GradesList } from '@/components/custom/grades-item'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useCurrentUser } from '@/lib/store'
import { getClasses, getSingleClass } from '@/lib/grades-api'
import { getLatestGradesLoad, getInitialTerm, getTermList, getTermTree, getHasSubterms, hasStorageData, addGradesLoad, reconstructAllInOneClassesFromHistory, reconstructClassDetailFromHistory, hasClassDetailInStorage } from '@/lib/grades-store'
import { transformGroupsToCategories } from '@/lib/utils'
import { flatForest, pathToLabel, barsForPath } from '@/lib/term-tree'
import { ChevronLeft, GitCommitHorizontal, Loader2, HardDriveDownload } from 'lucide-react'
import { ClassHeaderActions } from '@/components/custom/class-extras'

// Matches the CSS `ease` used across the app so the term transition curve is
// identical to the rest of the UI. A pure opacity cross-fade (no horizontal
// slide) — the slide caused transformed content to spill past the scroll
// container and flash scrollbars on every term switch.
const TERM_EASE = [0.25, 0.1, 0.25, 1]
const termPageVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
}
// Staggered fade-up reveal for the grade list/cards, mirroring the mobile
// cascade — each item rises a few px into place a beat after the previous. The
// small y drift is clipped by the `overflow-hidden` stage wrapper below so it
// can't extend the scroll area.
const gradesListContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
}
const gradeItemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: TERM_EASE } },
}

export function GradesLayout({ showTitle = true, pageTitle = 'Grades', element }) {
  const [terms, setTerms] = useState([]);
  const [currentTerm, setCurrentTerm] = useState('');
  // All-in-one portals (Skyward/PowerSchool) return every term's averages in one
  // payload plus a `termTree` — a nested forest of columns that cascade to
  // arbitrary depth (PR → term → semester → year). The roots are the top tabs;
  // each deeper level of the selected path renders its own subtab bar. Grades
  // are read from each class's `averages` dict by the deepest selected label, so
  // there's no re-fetch per term.
  const [termTree, setTermTree] = useState([]);
  const [hasSubterms, setHasSubterms] = useState(false);
  // Root→node labels of the currently-selected column (last entry = shown grade).
  const [selectedPath, setSelectedPath] = useState([]);
  const [allInOneClasses, setAllInOneClasses] = useState(null);
  const [progressByTerm, setProgressByTerm] = useState({});
  const [classesDataByTerm, setClassesDataByTerm] = useState({});
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [loadingTerms, setLoadingTerms] = useState({});
  const [storageMode, setStorageMode] = useState({});
  const [lastLoadedDate, setLastLoadedDate] = useState({});

  const user = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const abortControllerRef = useRef({});
  const userHasSelectedTermRef = useRef(false);
  const animationsEnabled = user ? user.animationsEnabled !== false : true;
  const isTimeTravelMode = location.pathname === '/statistics/timetravel';
  const isTimelineMode = location.pathname === '/statistics/timeline';

  async function fetchClasses(term = null, { initial = false } = {}) {
    const key = initial ? 'initial' : term;
    setLoadingTerms(prev => ({ ...prev, [key]: true }));
    setProgressByTerm(prev => ({ ...prev, [key]: { percent: initial ? 0 : 4, message: 'Initializing Connection' } }));

    const controller = new AbortController();
    abortControllerRef.current[key] = controller;

    try {
      const generator = getClasses(term);
      for await (const chunk of generator) {
        if (controller.signal.aborted) return;

        if (chunk.percent !== undefined) {
          setProgressByTerm(prev => ({ ...prev, [key]: { percent: chunk.percent, message: chunk.message } }));
        } else if (chunk.success === true) {
          if (initial) {
            // The forest drives the tabs: its roots are the top tabs, deeper
            // levels the cascading subtabs. Portals without a `termTree` (HAC,
            // per-term re-fetch) fall back to a flat depth-1 forest = the terms.
            const forest = chunk.termTree?.length ? chunk.termTree : flatForest(chunk.termList);
            setTermTree(forest);
            setTerms(forest.map((n) => n.label));
            setHasSubterms(!!chunk.hasSubterms);

            // Detect the all-in-one (Skyward-style) shape: a `termTree` or
            // per-class `averages` dicts mean every term is already in-hand.
            const allInOne = !!chunk.hasSubterms || (chunk.classes?.[0]?.averages != null);
            if (allInOne) setAllInOneClasses(chunk.classes);

            // Default selection: the path to the API's current term (a leaf), so
            // the right top tab + every subtab down to it start selected.
            const path = pathToLabel(forest, chunk.term);
            const defaultPath = path.length ? path : [chunk.term];
            if (!userHasSelectedTermRef.current) {
              setCurrentTerm(defaultPath[0]);
              setSelectedPath(defaultPath);
            }
            setClassesDataByTerm(prev => ({ ...prev, [chunk.term]: chunk.classes }));

            setLoadingTerms(prev => {
              const newState = { ...prev };
              delete newState.initial;
              newState[chunk.term] = false;
              return newState;
            });
            setProgressByTerm(prev => {
              const newState = { ...prev };
              delete newState.initial;
              return newState;
            });
            setStorageMode(prev => ({ ...prev, [chunk.term]: false }));
            setLastLoadedDate(prev => ({ ...prev, [chunk.term]: new Date() }));
          } else {
            setClassesDataByTerm(prev => ({ ...prev, [term]: chunk.classes }));
            setLoadingTerms(prev => ({ ...prev, [term]: false }));
            setProgressByTerm(prev => {
              const newState = { ...prev };
              delete newState[term];
              return newState;
            });
            setStorageMode(prev => ({ ...prev, [term]: false }));
            setLastLoadedDate(prev => ({ ...prev, [term]: new Date() }));
          }
        }
      }
    } catch (_) {
      setLoadingTerms(prev => ({ ...prev, [key]: false }));
    }
  }

  useEffect(() => {
    fetchClasses(null, { initial: true });
  }, []);

  const handleTabChange = (term) => {
    userHasSelectedTermRef.current = true;
    setCurrentTerm(term);
    // Reset the drill-down to the freshly-selected top tab.
    setSelectedPath([term]);
    setSelectedGrade(null);
    // All-in-one portals already hold every term's grades — just switch labels.
    if (allInOneClasses) return;
    if (classesDataByTerm[term] || loadingTerms[term]) return;
    fetchClasses(term);
  };

  // Select a column at subtab-bar level `level`. Selecting the parent itself
  // (value === the bar's parent) collapses back to that level's own grade;
  // selecting a child drills one level deeper.
  const handleSubtabChange = (level, value, parent) => {
    setSelectedPath((prev) => {
      const base = prev.slice(0, level + 1);
      return value === parent ? base : [...base, value];
    });
    setSelectedGrade(null);
  };

  // The label whose grade/detail we actually show: the deepest selected column.
  // Resolve a class's grade from its averages dict (all-in-one portals) or its
  // single `average` (HAC and other per-term portals).
  const effectiveTerm = selectedPath[selectedPath.length - 1] || currentTerm;
  const resolveGrade = (course) =>
    course && course.averages ? (course.averages[effectiveTerm] ?? '') : course?.average;
  const subtabBars = hasSubterms ? barsForPath(termTree, selectedPath) : [];
  const displayClasses = allInOneClasses || classesDataByTerm[currentTerm];
  // All-in-one portals (PowerSchool/Skyward) return ONE class list spanning every
  // term; a class that is "not in session" for the selected term has no entry for
  // it in its `averages` map (PowerSchool's greyed-out notInSession cell drops the
  // key entirely). Hide those so a class only shows under the terms it actually
  // exists in. An in-session-but-ungraded term keeps an empty-string entry, so key
  // presence — not truthiness — is the test. Per-term portals (HAC) already return
  // exactly the term's classes and carry no `averages` map, so they pass through.
  const visibleClasses = (displayClasses || []).filter((course) =>
    course && course.averages ? (effectiveTerm in course.averages) : true
  );

  // Command palette deep link: select the requested class once it's loaded.
  const pendingSelectRef = useRef(location.state?.selectCourse || null);
  useEffect(() => {
    if (!pendingSelectRef.current || !visibleClasses.length) return;
    const match = visibleClasses.find((c) => `${c.course}|${c.name}` === pendingSelectRef.current);
    pendingSelectRef.current = null;
    if (match) setSelectedGrade(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleClasses.length]);
  useEffect(() => {
    if (location.state?.selectCourse) pendingSelectRef.current = location.state.selectCourse;
  }, [location.state]);

  // Averages-only portals (Skyward) hand back grades without assignment scores;
  // fetch the per-class detail on demand so every right-panel element (grades,
  // what-if, impacts, ...) receives a class enriched with scores + categories,
  // and persist that detail into history for the storage/timeline features.
  const [detailByKey, setDetailByKey] = useState({});
  const [detailLoadingKey, setDetailLoadingKey] = useState(null);
  // Lets "Load from Storage" abort the in-flight /single-class fetch so its late
  // response can't overwrite the storage snapshot we just showed.
  const detailCancelRef = useRef(null);
  const detailKey = selectedGrade ? `${selectedGrade.course}|${effectiveTerm}` : null;
  const needsDetail = !!selectedGrade && !isTimeTravelMode &&
    !(selectedGrade.scores && selectedGrade.scores.length) && !!selectedGrade.averages;

  useEffect(() => {
    if (!needsDetail || !detailKey || detailByKey[detailKey]) return;
    let cancelled = false;
    detailCancelRef.current = { key: detailKey, cancel: () => { cancelled = true; } };
    setDetailLoadingKey(detailKey);
    getSingleClass(selectedGrade.course, effectiveTerm)
      .then((data) => {
        if (cancelled) return;
        const raw = data && data.class;
        if (!raw) return;
        // Flatten multi-group semesters (Skyward SM1/SM2) into categories/scores.
        const cls = transformGroupsToCategories(raw);
        setDetailByKey((prev) => ({ ...prev, [detailKey]: cls }));
        addGradesLoad(effectiveTerm, [{ ...selectedGrade, ...cls }]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDetailLoadingKey((k) => (k === detailKey ? null : k));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailKey, needsDetail]);

  const enrichedGrade = selectedGrade
    ? (needsDetail && detailByKey[detailKey] ? { ...selectedGrade, ...detailByKey[detailKey] } : selectedGrade)
    : null;
  const detailLoading = needsDetail && !detailByKey[detailKey];

  const handleLoadFromStorage = () => {
    const isInitialLoad = loadingTerms.initial;
    const termToLoad = isInitialLoad ? getInitialTerm() : currentTerm;

    if (!termToLoad) return;

    const latestLoad = getLatestGradesLoad(termToLoad);

    if (latestLoad) {
      if (isInitialLoad) {
        // Rebuild the cascade from storage: prefer the live forest, else the
        // persisted `termTree` (so nested subtabs survive an offline load), and
        // only fall back to a flat forest when no tree was ever stored.
        const storedTree = getTermTree();
        const forest = termTree.length
          ? termTree
          : (storedTree.length ? storedTree : flatForest(getTermList()));
        const allInOne = !!(hasSubterms || getHasSubterms());
        setTermTree(forest);
        setHasSubterms(allInOne);
        setTerms(forest.map((n) => n.label));
        const path = pathToLabel(forest, termToLoad);
        const defaultPath = path.length ? path : [termToLoad];
        setCurrentTerm(defaultPath[0]);
        setSelectedPath(defaultPath);
        // All-in-one portals resolve grades from a per-class `averages` dict, so
        // rebuild that from the full history; the top tab may be a coarse root
        // while the selected leaf differs, and a single per-term class list keyed
        // by the leaf wouldn't render under the root.
        if (allInOne) {
          setAllInOneClasses(reconstructAllInOneClassesFromHistory());
        }
        setClassesDataByTerm(prev => ({ ...prev, [termToLoad]: latestLoad.classes }));
        setLoadingTerms(prev => ({ ...prev, initial: false }));
        // Flag storage mode + last-loaded on both the leaf term and the (possibly
        // coarser) root tab now shown, so the "Last Loaded" banner appears.
        const loadedDate = new Date(latestLoad.loadedAt);
        setStorageMode(prev => ({ ...prev, [termToLoad]: true, [defaultPath[0]]: true }));
        setLastLoadedDate(prev => ({ ...prev, [termToLoad]: loadedDate, [defaultPath[0]]: loadedDate }));
      } else {
        setClassesDataByTerm(prev => ({ ...prev, [termToLoad]: latestLoad.classes }));
        setLoadingTerms(prev => ({ ...prev, [termToLoad]: false }));
        setStorageMode(prev => ({ ...prev, [termToLoad]: true }));
        setLastLoadedDate(prev => ({ ...prev, [termToLoad]: new Date(latestLoad.loadedAt) }));
      }
    }
  };

  // Populate the grade-details panel from stored history instead of the network —
  // pulls the selected class's latest scores/categories for the shown term. Also
  // aborts any in-flight fetch so it can't clobber the storage snapshot (this is
  // what lets the user "stop the load in place and load from storage instead").
  const handleLoadDetailFromStorage = () => {
    if (!selectedGrade || !detailKey) return;
    if (detailCancelRef.current?.key === detailKey) detailCancelRef.current.cancel();
    const detail = reconstructClassDetailFromHistory(effectiveTerm, selectedGrade.course, selectedGrade.name);
    if (detail) setDetailByKey((prev) => ({ ...prev, [detailKey]: detail }));
    setDetailLoadingKey((k) => (k === detailKey ? null : k));
  };
  const detailStorageAvailable = !!selectedGrade && !isTimeTravelMode &&
    hasClassDetailInStorage(effectiveTerm, selectedGrade.course, selectedGrade.name);

  const formatDate = (date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleViewLatestInTimeTravel = () => {
    if (!selectedGrade || !currentTerm) return;

    const gradesStore = user?.gradesStore || {};
    const termHistory = gradesStore.history?.[currentTerm] || {};
    const courseKey = `${selectedGrade.course}|${selectedGrade.name}`;
    const courseHistory = termHistory[courseKey] || [];

    if (courseHistory.length === 0) return;

    // Latest index is the last entry in the course history
    const latestIndex = courseHistory.length - 1;

    navigate('/statistics/timetravel', {
      state: {
        selectedGrade,
        term: currentTerm,
        historyIndex: latestIndex,
        from: 'timeline'
      }
    });
  };

  return (
    <div className="space-y-8 flex flex-col h-full overflow-clip" style={{ zoom: '0.9' }}>
      {showTitle &&
        <div className="flex items-center justify-between w-full">
          <h1 className="text-4xl font-bold">{pageTitle}</h1>
        </div>
      }
      <div className="flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className='space-x-2'>
          <ResizablePanel
            className='bg-card rounded-xl p-6 border flex flex-col gap-6 align-center min-w-[412px]'
            defaultSize={60}
          >
            <Tabs value={currentTerm} onValueChange={handleTabChange} className="w-full flex flex-col flex-1">
              {terms.length !== 0 && <TabsList className="w-full">
                {terms.map((tab) => (
                  <TabsTrigger key={tab} value={tab}>
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>}
              {/* One subtab bar per level of the selected path that has children,
                  so the cascade shows as many rows as the district defines. */}
              {subtabBars.map((bar, level) => (
                <div key={bar.parent} className="flex w-full gap-1 mt-2 rounded-lg bg-muted p-1">
                  {[bar.parent, ...bar.options].map((sub) => {
                    const active = bar.selected === sub;
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => handleSubtabChange(level, sub, bar.parent)}
                        className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>
              ))}
              {/* overflow-x-hidden kills the horizontal scrollbar; the inner
                  overflow-hidden wrapper clips the reveal's small vertical drift
                  so it can't extend the vertical scroll area either. */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                <div className="overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    // Key on the deepest selected label (effectiveTerm), not just
                    // the top tab, so the fade + list cascade replays when ANY
                    // level changes — top tab or a deeper subtab.
                    key={effectiveTerm || currentTerm || 'initial'}
                    variants={animationsEnabled ? termPageVariants : undefined}
                    initial={animationsEnabled ? 'enter' : false}
                    animate={animationsEnabled ? 'center' : undefined}
                    exit={animationsEnabled ? 'exit' : undefined}
                    transition={{ duration: 0.18, ease: TERM_EASE }}
                  >
                    {(loadingTerms[currentTerm] || loadingTerms.initial) && <div className='flex flex-col items-center justify-center'>
                      <div className='w-full text-center my-2'>{progressByTerm[currentTerm]?.message || progressByTerm.initial?.message}</div>
                      <Progress value={progressByTerm[currentTerm]?.percent || progressByTerm.initial?.percent || 0} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={handleLoadFromStorage}
                        disabled={!hasStorageData(loadingTerms.initial ? getInitialTerm() : currentTerm)}
                      >
                        Load from Storage
                      </Button>
                    </div>}
                    {!loadingTerms[currentTerm] && !loadingTerms.initial && displayClasses && (
                      <div className="mt-2">
                        {storageMode[currentTerm] && (
                          <div className="mb-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                            Last Loaded: {formatDate(lastLoadedDate[currentTerm])}
                          </div>
                        )}
                        {visibleClasses.length === 0 ? (
                          <div className="flex items-center justify-center h-16">
                            <p className="text-muted-foreground">No classes to display</p>
                          </div>
                        ) : (
                          <motion.div
                            variants={animationsEnabled ? gradesListContainer : undefined}
                            initial={animationsEnabled ? 'hidden' : false}
                            animate={animationsEnabled ? 'show' : undefined}
                          >
                            <GradesList variant={user.gradesView}>
                              {visibleClasses.map((course, index) => {
                                const grade = resolveGrade(course);
                                return (
                                  <motion.div
                                    key={index}
                                    variants={animationsEnabled ? gradeItemVariants : undefined}
                                    onClick={() => grade && setSelectedGrade(course)}
                                  >
                                    <GradesItem
                                      courseName={course.name}
                                      id={course.course}
                                      grade={grade}
                                    />
                                  </motion.div>
                                );
                              })}
                            </GradesList>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
                </div>
              </div>
            </Tabs>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel className='bg-card rounded-xl border flex flex-col min-w-[412px]'>
            <div className='flex items-center justify-between py-2 px-2 border-b'>
              {/* Balance the Goal/Notes buttons on the right so the title stays centered. */}
              {selectedGrade && !isTimeTravelMode && <div className={isTimelineMode ? 'w-7' : 'w-[60px]'} />}
              {isTimeTravelMode &&
                <Button
                  size="sm"
                  variant="outline"
                  className='h-7 w-7 p-0'
                  onClick={() => navigate('/statistics/timeline')}
                  title="Go to Timeline"
                >
                  <ChevronLeft size={18} />
                </Button>
              }
              {isTimelineMode && selectedGrade &&
                <Button
                  size="sm"
                  variant="outline"
                  className='h-7 w-7 p-0'
                  onClick={handleViewLatestInTimeTravel}
                  title="View in TimeTravel"
                >
                  <GitCommitHorizontal size={18} />
                </Button>
              }
              <div className='text-center text-sm font-medium text-muted-foreground flex-1 py-1'>
                {selectedGrade ? selectedGrade.name : 'Grade Details'}
              </div>
              {/* The grade-detail "Load from Storage" control lives below the
                  loading spinner (mirroring the main grades page), not up here —
                  so this slot is just a spacer to keep the title centered. */}
              {selectedGrade && !isTimeTravelMode ? (
                <ClassHeaderActions
                  grade={{
                    ...(enrichedGrade || selectedGrade),
                    average: (enrichedGrade || selectedGrade).average ?? (enrichedGrade || selectedGrade).averages?.[effectiveTerm],
                  }}
                />
              ) : null}
              {isTimeTravelMode ? (
                <div className="w-7"></div>
              ) : null}
            </div>
            <div className='p-6 flex-1 overflow-y-auto'>
              {!selectedGrade ? (
                <p className="text-muted-foreground text-center h-full flex items-center justify-center max-h-[46px]">
                  Select a grade to continue.
                </p>
              ) : detailLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                  <Loader2 className="animate-spin" size={28} />
                  <span className="text-sm">Loading assignments…</span>
                  {/* Same affordance as the main grades page: stop the in-flight
                      fetch and show the last stored assignments instead. */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={handleLoadDetailFromStorage}
                    disabled={!detailStorageAvailable}
                  >
                    <HardDriveDownload size={16} />
                    Load from Storage
                  </Button>
                </div>
              ) : (
                React.cloneElement(element, { selectedGrade: enrichedGrade, term: effectiveTerm })
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}