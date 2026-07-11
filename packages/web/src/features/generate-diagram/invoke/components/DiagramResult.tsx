import { useLocation } from 'react-router';
import { DIAGRAM_DATA } from '../constants';
import { useDiagram } from '../hooks/useDiagram';
import { useDiagramStore } from '../stores/useDiagramStore';
import { DiagramRenderer } from './DiagramRenderer';
import { Markdown } from './Markdown';

type Props = {
  diagramCode: string;
};

export const DiagramResult = (props: Props) => {
  const { diagramCode } = props;
  const { pathname } = useLocation();
  const { loading, diagramType, isEmpty } = useDiagram(pathname);
  const { diagramGenerationError } = useDiagramStore();

  const correctedDiagramCode = diagramCode
    .replace(/(^|\s)classDef(?!\s)/gm, '$1classDef ')
    .replace(/・/g, '/')
    .replace(/：/g, ':')
    .replace(/subgraph\s+(.*)/gm, (_, title) => `subgraph ${title.replace(/,/g, '')}`);

  return (
    <>
      {correctedDiagramCode.length > 0 && (
        <div className='rounded-6 bg-solid-gray-50'>
          <h3 className='p-4 text-std-18B-160'>
            {DIAGRAM_DATA[diagramType as keyof typeof DIAGRAM_DATA]?.title || 'チャート'}
          </h3>

          {loading && (
            <div className='p-4'>
              <Markdown>{['```mermaid', correctedDiagramCode, '```'].join('\n')}</Markdown>
            </div>
          )}

          {!loading && (
            <div className='p-4'>
              <DiagramRenderer code={correctedDiagramCode} />
            </div>
          )}
        </div>
      )}

      {!loading && isEmpty && (
        <div className='leading-175 text-solid-gray-536'>ダイアグラムがここに表示されます</div>
      )}

      {diagramGenerationError && (
        <div className='bg-red-50 p-4 text-error-2'>{diagramGenerationError.message}</div>
      )}
    </>
  );
};
