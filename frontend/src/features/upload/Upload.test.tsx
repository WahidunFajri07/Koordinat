import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  parseCsvSnippet, 
  autoDetectColumnRole, 
  validateColumnMapping 
} from './utils/parser';
import { UploadZone } from './UploadZone';
import { ColumnMapper } from './ColumnMapper';

describe('Upload parser and auto-detection utilities', () => {
  it('parses CSV snippet with comma delimiter and quotes properly', () => {
    const csv = `ID_PELANGGAN,LATITUDE,LONGITUDE\n531000000001,-6.2088,106.8456\n531000000002,-6.2090,106.8460`;
    const { headers, previewRows, totalRowsEstimated } = parseCsvSnippet(csv, 10);

    expect(headers).toEqual(['ID_PELANGGAN', 'LATITUDE', 'LONGITUDE']);
    expect(previewRows).toHaveLength(2);
    expect(previewRows[0]['ID_PELANGGAN']).toBe('531000000001');
    expect(totalRowsEstimated).toBe(2);
  });

  it('parses CSV with combined coordinates', () => {
    const csv = `KOORDINAT_TITIK\n"-6.649040,106.650070"\n"-7.398230,110.918835"`;
    const { headers, previewRows } = parseCsvSnippet(csv, 10);

    expect(headers).toEqual(['KOORDINAT_TITIK']);
    expect(previewRows[0]['KOORDINAT_TITIK']).toBe('-6.649040,106.650070');
  });

  it('correctly auto-detects column roles', () => {
    expect(autoDetectColumnRole('ID_PELANGGAN', ['531000000001'], 'master')).toBe('idpel');
    expect(autoDetectColumnRole('LATITUDE', ['-6.2088'], 'master')).toBe('latitude');
    expect(autoDetectColumnRole('LONGITUDE', ['106.8456'], 'master')).toBe('longitude');
    expect(autoDetectColumnRole('TITIK_KOORDINAT', ['-6.2088, 106.8456'], 'kosong')).toBe('coordinate_combined');
    expect(autoDetectColumnRole('NAMA_PELANGGAN', ['Budi'], 'master')).toBe('ignore');

    // PLN Master standard columns: idpel, koordinat_x, koordinat_y, tglbaca, jenis_pel
    expect(autoDetectColumnRole('idpel', ['531000000001'], 'master')).toBe('idpel');
    expect(autoDetectColumnRole('koordinat_x', ['106.8456'], 'master')).toBe('longitude');
    expect(autoDetectColumnRole('koordinat_y', ['-6.2088'], 'master')).toBe('latitude');
    expect(autoDetectColumnRole('tglbaca', ['05'], 'master')).toBe('tglbaca');
    expect(autoDetectColumnRole('jenis_pel', ['PASCA'], 'master')).toBe('jenis_pel');
  });

  it('validates required columns for Master, PDPJ, and Kosong', () => {
    // Master missing coordinates
    const invalidMaster = validateColumnMapping('master', {
      ID_PELANGGAN: 'idpel',
      NAMA: 'ignore',
    });
    expect(invalidMaster.isValid).toBe(false);

    // Master valid
    const validMaster = validateColumnMapping('master', {
      ID_PELANGGAN: 'idpel',
      LATITUDE: 'latitude',
      LONGITUDE: 'longitude',
    });
    expect(validMaster.isValid).toBe(true);

    // PDPJ missing IDPEL
    const invalidPdpj = validateColumnMapping('pdpj', {
      LATITUDE: 'latitude',
    });
    expect(invalidPdpj.isValid).toBe(false);

    // Kosong valid with combined coordinate
    const validKosong = validateColumnMapping('kosong', {
      KOORDINAT: 'coordinate_combined',
    });
    expect(validKosong.isValid).toBe(true);
  });
});

describe('UploadZone component', () => {
  it('renders title and sample data button', () => {
    const onSelect = vi.fn();
    const onLoadSample = vi.fn();

    render(
      <UploadZone
        fileType="master"
        onFileSelected={onSelect}
        onLoadSample={onLoadSample}
      />
    );

    expect(screen.getByText('Unggah Data Master Pelanggan')).toBeInTheDocument();
    const sampleBtn = screen.getByText('Gunakan Contoh Data Sintetis');
    expect(sampleBtn).toBeInTheDocument();

    fireEvent.click(sampleBtn);
    expect(onLoadSample).toHaveBeenCalledTimes(1);
  });
});

describe('ColumnMapper component', () => {
  it('renders columns and notifies role changes', () => {
    const onMappingChange = vi.fn();
    render(
      <ColumnMapper
        headers={['ID_PEL', 'LAT']}
        previewRows={[{ ID_PEL: '531000', LAT: '-6.2' }]}
        columnMapping={{ ID_PEL: 'idpel', LAT: 'latitude' }}
        fileType="master"
        onMappingChange={onMappingChange}
      />
    );

    expect(screen.getByText('ID_PEL')).toBeInTheDocument();
    expect(screen.getByText('LAT')).toBeInTheDocument();
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);

    fireEvent.change(selects[1], { target: { value: 'ignore' } });
    expect(onMappingChange).toHaveBeenCalledWith('LAT', 'ignore');
  });
});
