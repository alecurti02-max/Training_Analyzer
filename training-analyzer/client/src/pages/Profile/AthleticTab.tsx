import { useRef, useEffect, useState } from 'preact/hooks';
import { Card, BentoGrid } from '@/components/layout';
import { Modal } from '@/components/Modal/Modal.jsx';
import { getFitnessAssessment } from '@/scoring';
import { workouts as workoutsSig } from '@/store/workouts';
import { settings as settingsSig, muscleGroups as muscleGroupsSig } from '@/store/settings';
import { weights as weightsSig } from '@/store/weights';
import { renderBodyAvatar, getBodyPartInfo } from '../../../js/bodyAvatar.js';
import { FitnessAssessmentAthletic, AthleticMetrics, computeAthleticMetrics } from './Profile.jsx';

declare const Chart: any;

const RADAR_LABELS = ['Forza', 'Resistenza', 'Consistenza', 'Recupero', 'Progressione', 'Varieta', 'Proporzioni'];

export function AthleticTab() {
  const workouts = workoutsSig.value;
  const settings = settingsSig.value || {};
  const weights = weightsSig.value;
  const muscleGroups = muscleGroupsSig.value;

  const ctx = { workouts, settings, weights, muscleGroups };
  const fa = getFitnessAssessment(workouts as any, settings, weights as any, muscleGroups);
  const { metrics, radarValues } = computeAthleticMetrics({ workouts, settings });

  const avatarRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);
  const [partModal, setPartModal] = useState<any>(null);

  // Body avatar: reso da bodyAvatar.js (canvas/SVG) dentro il container.
  useEffect(() => {
    if (avatarRef.current) renderBodyAvatar(avatarRef.current, settings);
  }, [settings]);

  // Radar Chart.js (lifecycle gestito qui).
  useEffect(() => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (!canvasRef.current || !radarValues) return undefined;
    const isLight = !window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isLight ? '#0E1014' : '#F4F5F8';
    const gridColor = isLight ? 'rgba(14,16,20,0.10)' : 'rgba(244,245,248,0.10)';
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--pulse').trim() || '#00E5CE';
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'radar',
      data: {
        labels: RADAR_LABELS,
        datasets: [{
          label: 'Profilo', data: radarValues.map((v: number) => Math.round(v * 10) / 10),
          backgroundColor: acc + '26', borderColor: acc, pointBackgroundColor: acc,
          pointBorderColor: isLight ? '#fff' : '#0A0C0E', borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 0, max: 10, ticks: { stepSize: 2, color: textColor, backdropColor: 'transparent' }, grid: { color: gridColor }, pointLabels: { color: textColor, font: { size: 13, family: 'Poppins' } } } },
        plugins: { legend: { display: false } },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  });

  function onAvatarClick(e: any) {
    const part = e.target.closest('.body-avatar-svg [data-body-part]');
    if (!part) return;
    setPartModal(getBodyPartInfo(part.dataset.bodyPart, settings));
  }

  return (
    <>
      <BentoGrid cols="split">
        <Card hud>
          <div class="card-title">Il tuo corpo</div>
          <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Silhouette interattiva basata sulle tue misure. Clicca su una parte per i dettagli.</p>
          <div ref={avatarRef} onClick={onAvatarClick} />
        </Card>
        <Card hud>
          <div class="card-title">Radar ultimi 30 giorni</div>
          <div class="chart-container" style="height:300px"><canvas ref={canvasRef} /></div>
        </Card>
      </BentoGrid>

      <div class="card-grid"><AthleticMetrics metrics={metrics} /></div>

      <Card hud>
        <div class="card-title">Valutazione Forma Fisica</div>
        <FitnessAssessmentAthletic fa={fa} />
      </Card>

      <Modal open={!!partModal} onClose={() => setPartModal(null)} title={partModal?.title}>
        {partModal && (
          <>
            <div class="body-detail-row"><span>Valore corrente</span><strong>{partModal.valueStr}{partModal.delta || ''}</strong></div>
            <div class="body-detail-row"><span>Range tipico</span><strong>{partModal.idealStr}</strong></div>
            {partModal.extra && <div dangerouslySetInnerHTML={{ __html: partModal.extra }} />}
            <div class="body-detail-explanation">{partModal.explanation}</div>
          </>
        )}
      </Modal>
    </>
  );
}
