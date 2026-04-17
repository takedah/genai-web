import type { SystemContext } from 'genai-web';
import { useEffect, useState } from 'react';
import { useSystemContextApi } from './useSystemContextApi';

export const useSystemContext = () => {
  const { listSystemContexts, createSystemContext, deleteSystemContext, updateSystemContextTitle } =
    useSystemContextApi();
  const { data: systemContextResponse, mutate: mutateSystemContext } = listSystemContexts();
  const [systemContextList, setSystemContextList] = useState<SystemContext[]>([]);

  useEffect(() => {
    setSystemContextList(systemContextResponse ?? []);
  }, [systemContextResponse]);

  const onSaveSystemContext = async (title: string, systemContext: string) => {
    await createSystemContext(title, systemContext);
    mutateSystemContext();
  };

  const onDeleteSystemContext = async (systemContextId: string) => {
    try {
      const idx = systemContextList.findIndex((item) => item.systemContextId === systemContextId);
      if (idx >= 0) {
        setSystemContextList(systemContextList.filter((_, i) => i !== idx));
      }
      await deleteSystemContext(systemContextId);
      mutateSystemContext();
    } catch (e) {
      console.error(e);
    }
  };

  const onUpdateSystemContext = async (systemContextId: string, title: string) => {
    try {
      const idx = systemContextList.findIndex((item) => item.systemContextId === systemContextId);
      if (idx >= 0) {
        setSystemContextList(
          systemContextList.map((item, i) => {
            if (i === idx) {
              return { ...item, systemContextTitle: title };
            }
            return item;
          }),
        );
      }
      await updateSystemContextTitle(systemContextId, title);
      mutateSystemContext();
    } catch (e) {
      console.error(e);
    }
  };

  return {
    systemContextList,
    onSaveSystemContext,
    onDeleteSystemContext,
    onUpdateSystemContext,
  };
};
