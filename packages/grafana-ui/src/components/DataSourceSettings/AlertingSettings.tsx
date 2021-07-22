import {
  AlertingUIDataSourceJsonData,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
} from '@grafana/data';
import React, { useMemo } from 'react';
import { omit } from 'lodash';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { InlineField } from '../Forms/InlineField';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
import { Select } from '../Select/Select';
import { DataSourceHttpSettings } from '..';

interface Props<T> extends Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'> {
  alertmanagerDataSources: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  sigV4AuthEnabled: boolean;
}

export function AlertingSettings<T extends AlertingUIDataSourceJsonData>({
  alertmanagerDataSources,
  options,
  onOptionsChange,
  sigV4AuthEnabled,
}: Props<T>): JSX.Element {
  const alertmanagerOptions = useMemo(
    () =>
      alertmanagerDataSources.map((ds) => ({
        label: ds.name,
        value: ds.uid,
        imgUrl: ds.meta.info.logos.small,
        meta: ds.meta,
      })),
    [alertmanagerDataSources]
  );

  const onCustomRulerURLToggle = (event: React.SyntheticEvent<HTMLInputElement, Event>) => {
    const checked = event!.currentTarget.checked;
    if (checked) {
      onOptionsChange({
        ...options,
        jsonData: {
          ...options.jsonData,
          useCustomRulerURL: true,
        },
      });
    } else {
      onOptionsChange({
        ...options,
        jsonData: {
          ...(omit(options.jsonData, 'ruler') as T),
          useCustomRulerURL: false,
        },
        secureJsonData: omit(options.secureJsonData ?? {}, 'rulerBasicAuthPassword'),
        secureJsonFields: omit(options.secureJsonFields, 'rulerBasicAuthPassword'),
      });
    }
  };
  return (
    <>
      <h3 className="page-heading">Alerting</h3>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <Switch
            label="Manage alerts via Alerting UI"
            labelClass="width-13"
            checked={options.jsonData.manageAlerts !== false}
            onChange={(event) =>
              onOptionsChange({
                ...options,
                jsonData: { ...options.jsonData, manageAlerts: event!.currentTarget.checked },
              })
            }
          />
        </div>
        <div className="gf-form-inline">
          <Switch
            label="Custom ruler URL"
            labelClass="width-13"
            checked={options.jsonData.useCustomRulerURL === true}
            onChange={onCustomRulerURLToggle}
          />
        </div>
        <InlineFieldRow>
          <InlineField
            tooltip="The alertmanager that manages alerts for this data source"
            label="Alertmanager data source"
            labelWidth={26}
          >
            <Select
              width={29}
              menuShouldPortal
              options={alertmanagerOptions}
              onChange={(value) =>
                onOptionsChange({ ...options, jsonData: { ...options.jsonData, alertmanagerUid: value?.value } })
              }
              value={options.jsonData.alertmanagerUid}
            />
          </InlineField>
        </InlineFieldRow>
      </div>
      {!!options.jsonData.useCustomRulerURL && (
        <div className="page-body">
          <DataSourceHttpSettings
            title="Ruler"
            defaultUrl="http://localhost:9090/ruler"
            dataSourceConfig={dataSourceSettingsToRulerHTTPDataSourceSettings(options)}
            showAccessOptions={false}
            onChange={(data) => onOptionsChange(mergeInRulerHTTPDataSourceSettings(options, data))}
            sigV4AuthToggleEnabled={sigV4AuthEnabled}
          />
        </div>
      )}
    </>
  );
}

function dataSourceSettingsToRulerHTTPDataSourceSettings(
  settings: DataSourceSettings<any, any>
): DataSourceSettings<any, any> {
  const {
    url = '',
    basicAuth = false,
    withCredentials = false,
    basicAuthPassword = '',
    basicAuthUser = '',
    ...jsonData
  } = settings.jsonData.ruler ?? {};
  return {
    ...settings,
    url,
    basicAuth,
    withCredentials,
    basicAuthPassword,
    basicAuthUser,
    jsonData,
    secureJsonData:
      settings.secureJsonData?.rulerBasicAuthPassword !== undefined
        ? {
            basicAuthPassword: settings.secureJsonData.rulerBasicAuthPassword,
          }
        : {},
    secureJsonFields: {
      basicAuthPassword: settings.secureJsonFields.rulerBasicAuthPassword,
    },
  };
}

function mergeInRulerHTTPDataSourceSettings(
  settings: DataSourceSettings<any, any>,
  rulerHTTPSettings: DataSourceSettings<any, any>
): DataSourceSettings<any, any> {
  const out = {
    ...settings,
    jsonData: {
      ...settings.jsonData,
      ruler: {
        ...rulerHTTPSettings.jsonData,
        url: rulerHTTPSettings.url,
        basicAuth: rulerHTTPSettings.basicAuth,
        basicAuthPassword: rulerHTTPSettings.basicAuthPassword,
        basicAuthUser: rulerHTTPSettings.basicAuthUser,
        withCredentials: rulerHTTPSettings.withCredentials,
      },
    },
    secureJsonFields: {
      ...settings.secureJsonFields,
      rulerBasicAuthPassword: rulerHTTPSettings.secureJsonFields.basicAuthPassword,
    },
    secureJsonData: {
      ...settings.secureJsonData,
      rulerBasicAuthPassword: rulerHTTPSettings.secureJsonData?.basicAuthPassword,
    },
  };
  return out;
}
