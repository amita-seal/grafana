import { css } from '@emotion/css';
import { once } from 'lodash';
import React, { useState } from 'react';
import { DropEvent, FileRejection } from 'react-dropzone';

import {
  DataFrame,
  DataFrameJSON,
  dataFrameToJSON,
  DataQuery,
  DataSourceInstanceSettings,
  DataSourceRef,
  GrafanaTheme2,
} from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import {
  Modal,
  FileDropzone,
  FileDropzoneDefaultChildren,
  CustomScrollbar,
  useStyles2,
  Input,
  Icon,
} from '@grafana/ui';
import * as DFImport from 'app/features/dataframe-import';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

import { useDatasource } from '../../hooks';

import { AddNewDataSourceButton } from './AddNewDataSourceButton';
import { DataSourceList } from './DataSourceList';
import { matchDataSourceWithSearch } from './utils';

const INTERACTION_EVENT_NAME = 'dashboards_dspickermodal_clicked';
const INTERACTION_ITEM = {
  SELECT_DS: 'select_ds',
  UPLOAD_FILE: 'upload_file',
  CONFIG_NEW_DS: 'config_new_ds',
  CONFIG_NEW_DS_EMPTY_STATE: 'config_new_ds_empty_state',
  SEARCH: 'search',
  DISMISS: 'dismiss',
};

interface DataSourceModalProps {
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | string | null | undefined;
  onDismiss: () => void;
  recentlyUsed?: string[];
  reportedInteractionFrom?: string;
  queriesChanged?: (queries: GrafanaQuery[] | DataQuery[]) => void;
  runQueries?: () => void;
}

export function DataSourceModal({
  onChange,
  current,
  onDismiss,
  reportedInteractionFrom,
  queriesChanged,
  runQueries,
}: DataSourceModalProps) {
  const styles = useStyles2(getDataSourceModalStyles);
  const [search, setSearch] = useState('');
  const analyticsInteractionSrc = reportedInteractionFrom || 'modal';

  const onDismissModal = () => {
    onDismiss();
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.DISMISS, src: analyticsInteractionSrc });
  };
  const onChangeDataSource = (ds: DataSourceInstanceSettings) => {
    onChange(ds);
    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.SELECT_DS,
      ds_type: ds.type,
      src: analyticsInteractionSrc,
    });
  };
  // Memoizing to keep once() cached so it avoids reporting multiple times
  const reportSearchUsageOnce = React.useMemo(
    () =>
      once(() => {
        reportInteraction(INTERACTION_EVENT_NAME, { item: 'search', src: analyticsInteractionSrc });
      }),
    [analyticsInteractionSrc]
  );

  const grafanaDS = useDatasource('-- Grafana --');

  const onFileDrop = (acceptedFiles: File[], fileRejections: FileRejection[], event: DropEvent) => {
    if (!grafanaDS || !queriesChanged || !runQueries) {
      return;
    }
    DFImport.filesToDataframes(acceptedFiles).subscribe(async (next) => {
      const snapshot: DataFrameJSON[] = [];
      next.dataFrames.forEach((df: DataFrame) => {
        const dataframeJson = dataFrameToJSON(df);
        snapshot.push(dataframeJson);
      });
      await onChange(grafanaDS);
      queriesChanged([
        {
          refId: 'A',
          datasource: {
            type: 'grafana',
            uid: 'grafana',
          },
          queryType: GrafanaQueryType.Snapshot,
          snapshot: snapshot,
          file: next.file,
        },
      ]);
      runQueries();

      reportInteraction(INTERACTION_EVENT_NAME, {
        item: INTERACTION_ITEM.UPLOAD_FILE,
        src: analyticsInteractionSrc,
      });
    });

    if (fileRejections.length < 1) {
      onDismiss();
    }
  };

  return (
    <Modal
      title="Select data source"
      closeOnEscape={true}
      closeOnBackdropClick={true}
      isOpen={true}
      className={styles.modal}
      contentClassName={styles.modalContent}
      onClickBackdrop={onDismissModal}
      onDismiss={onDismissModal}
    >
      <div className={styles.leftColumn}>
        <Input
          autoFocus
          className={styles.searchInput}
          value={search}
          prefix={<Icon name="search" />}
          placeholder="Search data source"
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            reportSearchUsageOnce();
          }}
        />
        <CustomScrollbar>
          <DataSourceList
            className={styles.dataSourceList}
            dashboard={false}
            mixed={false}
            variables
            filter={(ds) => matchDataSourceWithSearch(ds, search) && !ds.meta.builtIn}
            onChange={onChangeDataSource}
            current={current}
            onClickEmptyStateCTA={() =>
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.CONFIG_NEW_DS_EMPTY_STATE,
                src: analyticsInteractionSrc,
              })
            }
          />
        </CustomScrollbar>
      </div>
      <div className={styles.rightColumn}>
        <div className={styles.builtInDataSources}>
          <DataSourceList
            className={styles.builtInDataSourceList}
            filter={(ds) => !!ds.meta.builtIn}
            dashboard
            mixed
            onChange={onChangeDataSource}
            current={current}
          />
          {config.featureToggles.editPanelCSVDragAndDrop && (
            <FileDropzone
              readAs="readAsArrayBuffer"
              fileListRenderer={() => undefined}
              options={{
                maxSize: DFImport.maxFileSize,
                multiple: false,
                accept: DFImport.acceptedFiles,
                onDrop: onFileDrop,
              }}
            >
              <FileDropzoneDefaultChildren />
            </FileDropzone>
          )}
        </div>
        <div className={styles.dsCTAs}>
          <AddNewDataSourceButton
            variant="secondary"
            onClick={() => {
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.CONFIG_NEW_DS,
                src: analyticsInteractionSrc,
              });
              onDismiss();
            }}
          />
        </div>
      </div>
    </Modal>
  );
}

function getDataSourceModalStyles(theme: GrafanaTheme2) {
  return {
    modal: css`
      width: 80%;
      height: 80%;
      max-width: 1200px;
      max-height: 900px;

      ${theme.breakpoints.down('md')} {
        width: 100%;
      }
    `,
    modalContent: css`
      display: flex;
      flex-direction: row;
      height: 100%;

      ${theme.breakpoints.down('md')} {
        flex-direction: column;
      }
    `,
    leftColumn: css`
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      padding-right: ${theme.spacing(4)};
      border-right: 1px solid ${theme.colors.border.weak};

      ${theme.breakpoints.down('md')} {
        width: 100%;
        height: 47%;
        border-right: 0;
        padding-right: 0;
        border-bottom: 1px solid ${theme.colors.border.weak};
        padding-bottom: ${theme.spacing(4)};
      }
    `,
    rightColumn: css`
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      justify-items: space-evenly;
      align-items: stretch;
      padding-left: ${theme.spacing(4)};

      ${theme.breakpoints.down('md')} {
        width: 100%;
        height: 53%;
        padding-left: 0;
        padding-top: ${theme.spacing(4)};
      }
    `,
    builtInDataSources: css`
      flex: 1;
      margin-bottom: ${theme.spacing(4)};
    `,
    dataSourceList: css`
      height: 100%;
    `,
    builtInDataSourceList: css`
      margin-bottom: ${theme.spacing(4)};
    `,
    dsCTAs: css`
      display: flex;
      flex-direction: row;
      width: 100%;
      justify-content: flex-end;

      ${theme.breakpoints.down('md')} {
        padding-bottom: ${theme.spacing(3)};
      }
    `,
    searchInput: css`
      width: 100%;
      min-height: 32px;
      margin-bottom: ${theme.spacing(1)};
    `,
  };
}
